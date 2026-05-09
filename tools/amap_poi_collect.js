const GUIZHOU_CITIES = [
  { name: '贵阳市', code: '520100' },
  { name: '六盘水市', code: '520200' },
  { name: '遵义市', code: '520300' },
  { name: '安顺市', code: '520400' },
  { name: '毕节市', code: '520500' },
  { name: '铜仁市', code: '520600' },
  { name: '黔西南州', code: '522300' },
  { name: '黔东南州', code: '522600' },
  { name: '黔南州', code: '522700' }
];

const POI_TYPES = [
  { id: 'highway_service_area', label: '高速服务区', keyword: '高速服务区', priority: 50, maxPages: 12 },
  { id: 'service_area', label: '服务区', keyword: '服务区', priority: 40, maxPages: 12 },
  { id: 'gas_station', label: '加油站', keyword: '加油站', priority: 20, maxPages: 4 },
  { id: 'rest_area', label: '休息区', keyword: '休息区', priority: 30, maxPages: 8 },
  { id: 'toll_station', label: '收费站', keyword: '收费站', priority: 10, maxPages: 8 }
];

const TYPE_BY_ID = Object.fromEntries(POI_TYPES.map(item => [item.id, item]));

const GUIZHOU_BOUNDS = {
  minLng: 103.3,
  maxLng: 109.8,
  minLat: 24.2,
  maxLat: 29.5
};

const BAD_TERMS = [
  '政务',
  '社区',
  '物业',
  '客服',
  '客户服务',
  '售后',
  '维修',
  '营业厅',
  '游客',
  '景区',
  '便民',
  '服务中心',
  '服务站'
];

const HIGHWAY_TERMS = [
  '高速',
  '公路',
  '收费站',
  '服务区',
  '停车区',
  '沪昆',
  '兰海',
  '杭瑞',
  '厦蓉',
  '银百',
  '蓉遵',
  '贵阳绕城',
  '贵黔',
  '贵遵'
];

function statusLine(text) {
  window.__COLLECT_STATUS = text;
  const el = document.getElementById('status');
  if (el) el.textContent = text;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function getPoiLocation(poi) {
  const loc = poi && poi.location;
  if (!loc) return null;
  if (typeof loc === 'string') {
    const parts = loc.split(',').map(Number);
    if (parts.length === 2 && parts.every(Number.isFinite)) return { lng: parts[0], lat: parts[1] };
  }
  const lng = toNumber(loc.lng ?? loc.getLng?.());
  const lat = toNumber(loc.lat ?? loc.getLat?.());
  if (lng == null || lat == null) return null;
  return { lng, lat };
}

function inGuizhou(location) {
  return location.lng >= GUIZHOU_BOUNDS.minLng &&
    location.lng <= GUIZHOU_BOUNDS.maxLng &&
    location.lat >= GUIZHOU_BOUNDS.minLat &&
    location.lat <= GUIZHOU_BOUNDS.maxLat;
}

function normalizeName(name) {
  return String(name || '')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[·.\-\s]/g, '')
    .replace(/贵州省|中国石化|中国石油|中石化|中石油|中国海油/g, '')
    .trim();
}

function distanceMeters(a, b) {
  const earth = 6371000;
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earth * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function inferType(baseTypeId, poi) {
  const text = `${poi.name || ''}${poi.type || ''}${poi.address || ''}`;
  if (text.includes('高速') && text.includes('服务区')) return 'highway_service_area';
  if (text.includes('停车区') && baseTypeId === 'rest_area') return 'rest_area';
  if (text.includes('收费站')) return 'toll_station';
  if (text.includes('加油站') || text.includes('加能站') || text.includes('油站')) return 'gas_station';
  return baseTypeId;
}

function relevanceWarnings(item) {
  const text = `${item.name}${item.typeText}${item.address}`;
  const warnings = [];
  if (!inGuizhou(item.location)) warnings.push('坐标不在贵州范围');

  if ((item.typeId === 'service_area' || item.typeId === 'highway_service_area' || item.typeId === 'rest_area') &&
      BAD_TERMS.some(term => text.includes(term)) &&
      !HIGHWAY_TERMS.some(term => text.includes(term))) {
    warnings.push('疑似非高速服务设施');
  }

  if ((item.typeId === 'service_area' || item.typeId === 'highway_service_area') && !text.includes('服务区')) {
    warnings.push('名称不含服务区');
  }
  if (item.typeId === 'gas_station' && !/(加油站|加能站|油站|能源)/.test(text)) warnings.push('名称不似加油站');
  if (item.typeId === 'rest_area' && !/(休息区|停车区)/.test(text)) warnings.push('名称不似休息区');
  if (item.typeId === 'toll_station' && !text.includes('收费站')) warnings.push('名称不含收费站');

  return warnings;
}

function normalizePoi(poi, keywordDef, city, pageIndex) {
  const location = getPoiLocation(poi);
  if (!location) return null;
  const typeId = inferType(keywordDef.id, poi);
  const item = {
    id: poi.id || '',
    name: poi.name || '',
    typeId,
    typeLabel: TYPE_BY_ID[typeId].label,
    sourceKeyword: keywordDef.keyword,
    sourceCity: city.name,
    pageIndex,
    address: poi.address || '',
    district: poi.district || '',
    adcode: poi.adcode || '',
    typeText: poi.type || '',
    typeCode: poi.typecode || '',
    location,
    matchCount: 1,
    sources: [`${city.name}/${keywordDef.keyword}`],
    warnings: []
  };
  item.warnings = relevanceWarnings(item);
  item.trusted = item.warnings.length === 0;
  return item;
}

function mergeItems(existing, incoming) {
  existing.matchCount += 1;
  existing.sources = Array.from(new Set([...existing.sources, ...incoming.sources]));
  if (TYPE_BY_ID[incoming.typeId].priority > TYPE_BY_ID[existing.typeId].priority) {
    existing.typeId = incoming.typeId;
    existing.typeLabel = incoming.typeLabel;
  }
  existing.trusted = existing.trusted || incoming.trusted;
  existing.warnings = Array.from(new Set([...existing.warnings, ...incoming.warnings]));
  if (!existing.address && incoming.address) existing.address = incoming.address;
  if (!existing.district && incoming.district) existing.district = incoming.district;
}

function dedupeItems(items) {
  const kept = [];
  const dropped = [];
  const byId = new Map();

  items.forEach(item => {
    if (!inGuizhou(item.location)) {
      dropped.push({ ...item, dropReason: '坐标不在贵州范围' });
      return;
    }

    let duplicate = item.id ? byId.get(item.id) : null;
    if (!duplicate) {
      const nameKey = normalizeName(item.name);
      duplicate = kept.find(candidate => {
        const sameName = normalizeName(candidate.name) === nameKey && nameKey.length >= 2;
        const near = distanceMeters(candidate.location, item.location) <= 900;
        const samePoint = distanceMeters(candidate.location, item.location) <= 160;
        return (sameName && near) || samePoint;
      });
    }

    if (duplicate) {
      mergeItems(duplicate, item);
      dropped.push({ ...item, dropReason: `重复点：${duplicate.name}` });
      return;
    }

    kept.push(item);
    if (item.id) byId.set(item.id, item);
  });

  return { kept, dropped };
}

function searchPageOnce(keywordDef, cityValue, pageIndex, pageSize) {
  return new Promise(resolve => {
    const search = new AMap.PlaceSearch({
      city: cityValue,
      citylimit: true,
      pageSize,
      pageIndex,
      extensions: 'all'
    });

    search.search(keywordDef.keyword, (status, result) => {
      if (status === 'complete' && result && result.poiList) {
        resolve({
          ok: true,
          count: Number(result.poiList.count || 0),
          pois: result.poiList.pois || []
        });
        return;
      }
      if (status === 'no_data') {
        resolve({ ok: true, count: 0, pois: [], info: status });
        return;
      }
      resolve({ ok: false, count: 0, pois: [], info: result && result.info ? result.info : status });
    });
  });
}

async function searchPage(keywordDef, city, pageIndex, pageSize) {
  const attempts = [city.code, city.name];
  let last = null;
  for (const cityValue of attempts) {
    const result = await searchPageOnce(keywordDef, cityValue, pageIndex, pageSize);
    if (result.ok) return result;
    last = result;
    await sleep(120);
  }
  return last || { ok: false, count: 0, pois: [], info: 'unknown' };
}

async function waitForAmap() {
  for (let i = 0; i < 120; i += 1) {
    if (window.AMap && AMap.PlaceSearch) return;
    await sleep(500);
  }
  throw new Error('AMap.PlaceSearch 加载超时');
}

window.collectGuizhouExpresswayPois = async function collectGuizhouExpresswayPois(options = {}) {
  await waitForAmap();
  const delayMs = Math.max(0, Number(options.delayMs ?? 350));
  const pageSize = Math.max(1, Math.min(25, Number(options.pageSize ?? 25)));
  const raw = [];
  const failures = [];

  for (const keywordDef of POI_TYPES) {
    const maxPages = Number(options.maxPagesByType?.[keywordDef.id] ?? keywordDef.maxPages);
    for (const city of GUIZHOU_CITIES) {
      for (let page = 1; page <= maxPages; page += 1) {
        statusLine(`检索中：${city.name} / ${keywordDef.keyword} / 第 ${page} 页`);
        const result = await searchPage(keywordDef, city, page, pageSize);
        if (!result.ok) {
          failures.push({ city: city.name, keyword: keywordDef.keyword, page, info: result.info || '' });
          break;
        }

        const normalized = result.pois
          .map(poi => normalizePoi(poi, keywordDef, city, page))
          .filter(Boolean);
        raw.push(...normalized);

        if (normalized.length === 0 || page * pageSize >= result.count) break;
        await sleep(delayMs);
      }
    }
  }

  const { kept, dropped } = dedupeItems(raw);
  const items = kept.sort((a, b) => TYPE_BY_ID[b.typeId].priority - TYPE_BY_ID[a.typeId].priority || a.name.localeCompare(b.name, 'zh'));
  const payload = {
    generated_at: new Date().toISOString(),
    source: 'amap_place_search_jsapi',
    keywords: POI_TYPES.map(item => item.keyword),
    city_strategy: 'guizhou_9_prefecture_adcodes',
    raw_count: raw.length,
    clean_count: items.length,
    dropped_count: dropped.length,
    failed_count: failures.length,
    items,
    dropped,
    failures
  };

  window.__COLLECT_RESULT = payload;
  statusLine(`完成：原始 ${raw.length} 条，清洗后 ${items.length} 条`);
  return payload;
};
