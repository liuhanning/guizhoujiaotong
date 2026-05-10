import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve('.');
const OUTPUT = join(ROOT, 'data', 'guizhou_roads.geojson');
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://z.overpass-api.de/api/interpreter'
];

const HIGHWAY_PATTERN = '^motorway$';
const GUIZHOU_BOUNDS = {
  minLng: 103.3,
  maxLng: 109.8,
  minLat: 24.2,
  maxLat: 29.5
};

const ROAD_CLASSES = {
  motorway: { id: 'motorway', label: '高速公路' }
};

const X_PI = Math.PI * 3000.0 / 180.0;
const A = 6378245.0;
const EE = 0.00669342162296594323;
const EARTH_METERS_PER_DEGREE = 111320;
const ENDPOINT_MATCH_METERS = 80;
const STRICT_ENDPOINT_MATCH_METERS = 8;
const MAX_JOIN_ANGLE_DEGREES = 75;
const MAX_STRICT_JOIN_ANGLE_DEGREES = 120;

function buildAreaQuery() {
  return `[out:json][timeout:600];
area["boundary"="administrative"]["admin_level"="4"]["name"="贵州省"]->.a;
way(area.a)["highway"~"${HIGHWAY_PATTERN}"];
out tags geom;`;
}

function buildBboxQuery() {
  const bbox = `${GUIZHOU_BOUNDS.minLat},${GUIZHOU_BOUNDS.minLng},${GUIZHOU_BOUNDS.maxLat},${GUIZHOU_BOUNDS.maxLng}`;
  return `[out:json][timeout:600][bbox:${bbox}];
way["highway"~"${HIGHWAY_PATTERN}"];
out tags geom;`;
}

function outOfChina(lng, lat) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function transformLng(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
  return ret;
}

function wgs84ToGcj02(lng, lat) {
  if (outOfChina(lng, lat)) return [lng, lat];
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * Math.PI);
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * Math.PI);
  return [lng + dLng, lat + dLat];
}

function inGuizhou(lng, lat) {
  return lng >= GUIZHOU_BOUNDS.minLng &&
    lng <= GUIZHOU_BOUNDS.maxLng &&
    lat >= GUIZHOU_BOUNDS.minLat &&
    lat <= GUIZHOU_BOUNDS.maxLat;
}

async function postOverpass(query) {
  let lastError = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': 'guizhojiaotong-road-network/1.0'
        },
        body: new URLSearchParams({ data: query })
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`${endpoint} ${response.status}: ${text.slice(0, 180)}`);
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      console.warn(`Overpass endpoint failed: ${endpoint}: ${error.message}`);
    }
  }
  throw lastError || new Error('All Overpass endpoints failed');
}

async function fetchRoadElements() {
  const areaData = await postOverpass(buildAreaQuery());
  if (Array.isArray(areaData.elements) && areaData.elements.length > 0) return areaData.elements;
  console.warn('Area query returned no roads, falling back to bbox query.');
  const bboxData = await postOverpass(buildBboxQuery());
  return bboxData.elements || [];
}

function featureFromWay(way) {
  const highway = way.tags?.highway;
  const roadClass = ROAD_CLASSES[highway];
  if (!roadClass || !Array.isArray(way.geometry) || way.geometry.length < 2) return null;
  if (!way.geometry.some(point => inGuizhou(point.lon, point.lat))) return null;

  const coordinates = way.geometry.map(point => wgs84ToGcj02(point.lon, point.lat));
  return {
    type: 'Feature',
    properties: {
      osm_id: way.id,
      name: way.tags?.name || '',
      ref: way.tags?.ref || '',
      highway,
      roadClass: roadClass.id,
      roadLabel: roadClass.label,
      source: 'openstreetmap_overpass',
      crs: 'gcj02_for_amap'
    },
    geometry: {
      type: 'LineString',
      coordinates
    }
  };
}

function coordKey(coord, precision = 5) {
  return `${coord[0].toFixed(precision)},${coord[1].toFixed(precision)}`;
}

function roundCoord(coord) {
  return [Number(coord[0].toFixed(6)), Number(coord[1].toFixed(6))];
}

function extractRefParts(ref) {
  return String(ref || '')
    .split(/[;；,，/、]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function distanceMeters(a, b) {
  const lat = (a[1] + b[1]) / 2;
  const lngScale = EARTH_METERS_PER_DEGREE * Math.cos(lat * Math.PI / 180);
  const dx = (a[0] - b[0]) * lngScale;
  const dy = (a[1] - b[1]) * EARTH_METERS_PER_DEGREE;
  return Math.sqrt(dx * dx + dy * dy);
}

function vectorMeters(from, to) {
  const lat = (from[1] + to[1]) / 2;
  const lngScale = EARTH_METERS_PER_DEGREE * Math.cos(lat * Math.PI / 180);
  return [
    (to[0] - from[0]) * lngScale,
    (to[1] - from[1]) * EARTH_METERS_PER_DEGREE
  ];
}

function angleDegrees(a, b) {
  const aLength = Math.hypot(a[0], a[1]);
  const bLength = Math.hypot(b[0], b[1]);
  if (!aLength || !bLength) return 0;
  const cosine = Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (aLength * bLength)));
  return Math.acos(cosine) * 180 / Math.PI;
}

function startVector(path) {
  return vectorMeters(path[0], path[1]);
}

function endVector(path) {
  return vectorMeters(path[path.length - 2], path[path.length - 1]);
}

function joinAllowed(distance, angle) {
  if (distance > ENDPOINT_MATCH_METERS) return false;
  const maxAngle = distance <= STRICT_ENDPOINT_MATCH_METERS
    ? MAX_STRICT_JOIN_ANGLE_DEGREES
    : MAX_JOIN_ANGLE_DEGREES;
  return angle <= maxAngle;
}

function joinCandidates(path, candidate) {
  const start = path[0];
  const end = path[path.length - 1];
  const candidateStart = candidate[0];
  const candidateEnd = candidate[candidate.length - 1];
  const pathStartVector = startVector(path);
  const pathEndVector = endVector(path);
  const candidateStartVector = startVector(candidate);
  const candidateEndVector = endVector(candidate);

  return [
    {
      mode: 'append',
      distance: distanceMeters(end, candidateStart),
      angle: angleDegrees(pathEndVector, candidateStartVector)
    },
    {
      mode: 'append-reverse',
      distance: distanceMeters(end, candidateEnd),
      angle: angleDegrees(pathEndVector, vectorMeters(candidateEnd, candidate[candidate.length - 2]))
    },
    {
      mode: 'prepend',
      distance: distanceMeters(start, candidateEnd),
      angle: angleDegrees(candidateEndVector, pathStartVector)
    },
    {
      mode: 'prepend-reverse',
      distance: distanceMeters(start, candidateStart),
      angle: angleDegrees(vectorMeters(candidate[1], candidateStart), pathStartVector)
    }
  ].filter(option => joinAllowed(option.distance, option.angle));
}

function applyJoin(path, candidate, mode) {
  if (mode === 'append') return path.concat(candidate.slice(1));
  if (mode === 'append-reverse') return path.concat([...candidate].reverse().slice(1));
  if (mode === 'prepend') return candidate.concat(path.slice(1));
  return [...candidate].reverse().concat(path.slice(1));
}

function sqSegDist(point, start, end) {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = end[0];
      y = end[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

function simplifyPath(points, tolerance) {
  if (points.length <= 2) return points;
  const sqTolerance = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  const stack = [[0, points.length - 1]];
  keep[0] = 1;
  keep[points.length - 1] = 1;

  while (stack.length) {
    const [first, last] = stack.pop();
    let maxSqDist = 0;
    let index = 0;

    for (let i = first + 1; i < last; i += 1) {
      const sqDist = sqSegDist(points[i], points[first], points[last]);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }

    if (maxSqDist > sqTolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, index) => keep[index]);
}

function mergePathGroup(paths) {
  const unused = paths.map(path => path.map(roundCoord)).filter(path => path.length > 1);
  const merged = [];

  while (unused.length) {
    let path = unused.pop();
    let changed = true;

    while (changed) {
      changed = false;
      let best = null;

      for (let i = unused.length - 1; i >= 0; i -= 1) {
        const candidate = unused[i];
        const options = joinCandidates(path, candidate);
        for (const option of options) {
          const score = option.distance + option.angle * 2;
          if (!best || score < best.score) {
            best = { ...option, index: i, score };
          }
        }
      }

      if (best) {
        const [candidate] = unused.splice(best.index, 1);
        path = applyJoin(path, candidate, best.mode);
        changed = true;
      }
    }

    merged.push(path);
  }

  return merged;
}

function mergeAndSimplifyFeatures(features) {
  const groups = new Map();
  const tolerances = {
    motorway: 0.00012
  };
  const output = [];

  for (const feature of features) {
    const props = feature.properties;
    const refs = extractRefParts(props.ref);
    const routeKeys = refs.length ? refs : [props.name || props.ref || 'unnamed'];
    const keyKind = refs.length ? 'ref' : 'name';

    for (const routeKey of routeKeys) {
      const key = [props.roadClass, props.highway, keyKind, routeKey].join('|');
      if (!groups.has(key)) {
        groups.set(key, {
          props: {
            ...props,
            ref: keyKind === 'ref' ? routeKey : props.ref || '',
            routeKey,
            routeKeyKind: keyKind
          },
          paths: [],
          names: new Set(),
          sourceRefs: new Set()
        });
      }

      const group = groups.get(key);
      if (props.name) group.names.add(props.name);
      refs.forEach(ref => group.sourceRefs.add(ref));
      group.paths.push(feature.geometry.coordinates);
    }
  }

  for (const group of groups.values()) {
    const mergedPaths = mergePathGroup(group.paths);
    const tolerance = tolerances[group.props.roadClass] || 0.0002;
    const names = Array.from(group.names).sort((a, b) => a.localeCompare(b, 'zh'));
    const sourceRefs = Array.from(group.sourceRefs).sort((a, b) => a.localeCompare(b, 'zh'));
    const simplifiedPaths = mergedPaths
      .map(path => simplifyPath(path, tolerance))
      .filter(path => path.length >= 2);

    if (!simplifiedPaths.length) continue;

    output.push({
      type: 'Feature',
      properties: {
        ...group.props,
        name: names.join(' / ') || group.props.name || '',
        sourceRefs,
        merged_index: 0,
        part_count: simplifiedPaths.length
      },
      geometry: simplifiedPaths.length === 1
        ? {
            type: 'LineString',
            coordinates: simplifiedPaths[0]
          }
        : {
            type: 'MultiLineString',
            coordinates: simplifiedPaths
          }
    });
  }

  return output;
}

async function main() {
  const elements = await fetchRoadElements();
  const rawFeatures = elements
    .filter(element => element.type === 'way')
    .map(featureFromWay)
    .filter(Boolean);
  const features = mergeAndSimplifyFeatures(rawFeatures);

  const counts = {};
  for (const feature of features) {
    const key = feature.properties.roadClass;
    counts[key] = (counts[key] || 0) + 1;
  }

  const geojson = {
    type: 'FeatureCollection',
    name: 'guizhou_major_roads_gcj02',
    generated_at: new Date().toISOString(),
    source: 'OpenStreetMap Overpass API',
    crs_note: 'Coordinates converted from WGS84 to GCJ-02 for AMap overlay.',
    highway_filter: HIGHWAY_PATTERN,
    raw_feature_count: rawFeatures.length,
    feature_count: features.length,
    counts,
    features
  };

  await mkdir(join(ROOT, 'data'), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(geojson)}\n`, 'utf-8');
  console.log(`Wrote ${features.length} road features to ${OUTPUT}`);
  console.log(JSON.stringify(counts, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
