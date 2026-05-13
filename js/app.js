const DATA_URL = 'data/guizhou_expressway_pois.json';
const ROAD_URL = 'data/guizhou_roads.geojson';
const BOUNDARY_URL = 'data/guizhou_boundary.geojson';
const COUNTIES_URL = 'data/guizhou_counties.geojson';
const TERRAIN_URL = 'data/guizhou_terrain.geojson';  // 地形数据
const CACHE_KEY = 'guizhou_expressway_pois_v1';

const GUIZHOU_BOUNDS = {
  minLng: 103.3,
  maxLng: 109.8,
  minLat: 24.2,
  maxLat: 29.5
};

const POI_TYPES = [
  { id: 'highway_service_area', label: '高速服务区', color: '#d83b33', priority: 50 },
  { id: 'service_area', label: '服务区', color: '#f08a24', priority: 40 },
  { id: 'gas_station', label: '加油站', color: '#1f78d1', priority: 20 },
  { id: 'rest_area', label: '休息区', color: '#2f9e58', priority: 30 },
  { id: 'toll_station', label: '收费站', color: '#7a4cbd', priority: 10 }
];

const TYPE_BY_ID = Object.fromEntries(POI_TYPES.map(item => [item.id, item]));

// ========== 高德地图底图样式配置 ==========
const MAP_STYLES = {
  normal: {
    name: '标准样式（默认）',
    styleId: 'amap://styles/normal'
  },
  dark: {
    name: '深色模式',
    styleId: 'amap://styles/dark'
  },
  light: {
    name: '浅色模式',
    styleId: 'amap://styles/light'
  },
  darkblue: {
    name: '深蓝色',
    styleId: 'amap://styles/darkblue'
  },
  macaron: {
    name: '马卡龙',
    styleId: 'amap://styles/macaron'
  },
  graffiti: {
    name: '涂鸦风格',
    styleId: 'amap://styles/graffiti'
  },
  fresh: {
    name: '清新蓝',
    styleId: 'amap://styles/fresh'
  },
  grey: {
    name: '灰色',
    styleId: 'amap://styles/grey'
  },
  whitesmoke: {
    name: '淡灰白',
    styleId: 'amap://styles/whitesmoke'
  },
  blue: {
    name: '深蓝（科技感）',
    styleId: 'amap://styles/blue'
  },
  darkgray: {
    name: '深灰',
    styleId: 'amap://styles/darkgray'
  },
  normal_night: {
    name: '夜间模式',
    styleId: 'amap://styles/dark'
  },
  arcgis: {
    name: 'ArcGIS专业风格',
    styleId: 'amap://styles/grey'  // 使用高德官方雅士灰样式（专业风格）
  }
};

let currentMapStyle = 'normal';

// ========== 不同底图样式对应的覆盖层颜色配置 ==========
const OVERLAY_COLORS = {
  normal: {
    strokeColor: '#334155',  // 深灰色轮廓
    strokeOpacity: 0.5,
    label: '标准'
  },
  light: {
    strokeColor: '#475569',  // 稍深灰色
    strokeOpacity: 0.6,
    label: '浅色'
  },
  dark: {
    strokeColor: '#94a3b8',  // 浅灰色（深色底图上）
    strokeOpacity: 0.7,
    label: '深色'
  },
  grey: {
    strokeColor: '#475569',  // 中灰色
    strokeOpacity: 0.6,
    label: '灰色'
  },
  blue: {
    strokeColor: '#60a5fa',  // 蓝色调
    strokeOpacity: 0.7,
    label: '深蓝'
  },
  fresh: {
    strokeColor: '#34d399',  // 青色调
    strokeOpacity: 0.6,
    label: '草色'
  },
  arcgis: {
    strokeColor: '#1e293b',  // ArcGIS风格深灰
    strokeOpacity: 0.75,
    label: 'ArcGIS'
  },
  // 其他样式使用默认值
  default: {
    strokeColor: '#334155',
    strokeOpacity: 0.5,
    label: '默认'
  }
};

// ========== 高德地图视图模式配置 ==========
const MAP_VIEWS = {
  standard: {
    name: '标准',
    icon: '🗺️',
    layers: [new AMap.TileLayer()]  // 标准矢量地图
  },
  hybrid: {
    name: '混合',
    icon: '🛰️',
    layers: [
      new AMap.TileLayer.Satellite(),  // 卫星影像
      new AMap.TileLayer.RoadNet()     // 路网叠加
    ]
  },
  satellite: {
    name: '卫星',
    icon: '🌍',
    layers: [new AMap.TileLayer.Satellite()]  // 纯卫星影像
  }
};

let currentMapView = 'standard';

function applyMapStyle(styleName) {
  const style = MAP_STYLES[styleName];
  if (!style || !map) return;
  
  // 应用高德地图底图样式
  map.setMapStyle(style.styleId);
  
  // 保存用户选择
  localStorage.setItem('selected-map-style', styleName);
  currentMapStyle = styleName;
  
  // 更新县区轮廓和边界遮罩的颜色以适配底图样式
  updateOverlaysForStyle(styleName);
}

function initMapStyleSelector() {
  // 读取保存的样式，默认使用ArcGIS专业风格
  const savedStyle = localStorage.getItem('selected-map-style') || 'arcgis';
  
  // 创建选择器
  const styleSelect = document.createElement('select');
  styleSelect.id = 'map-style-selector';
  styleSelect.className = 'map-style-selector';
  styleSelect.innerHTML = '<option value="">🎨 底图样式</option>' + 
    Object.entries(MAP_STYLES).map(([key, style]) => 
      `<option value="${key}" ${key === savedStyle ? 'selected' : ''}>${style.name}</option>`
    ).join('');
  
  // 插入到页面
  const panel = document.querySelector('#panel');
  const firstCard = panel?.querySelector('.card');
  if (firstCard) {
    firstCard.parentNode.insertBefore(styleSelect, firstCard);
  }
  
  // 绑定事件
  styleSelect.addEventListener('change', (e) => {
    if (e.target.value) {
      applyMapStyle(e.target.value);
    }
  });
  
  // 应用初始样式
  applyMapStyle(savedStyle);
}

function applyMapView(viewName) {
  const view = MAP_VIEWS[viewName];
  if (!view || !map) return;
  
  // 设置地图图层
  map.setLayers(view.layers);
  
  // 保存用户选择
  localStorage.setItem('selected-map-view', viewName);
  currentMapView = viewName;
}

function initMapViewSwitcher() {
  // 读取保存的视图
  const savedView = localStorage.getItem('selected-map-view') || 'standard';
  
  // 创建切换按钮组容器
  const viewSwitcher = document.createElement('div');
  viewSwitcher.className = 'map-view-switcher';
  
  // 创建标题
  const title = document.createElement('div');
  title.className = 'view-switcher-title';
  title.textContent = '📍 视图模式';
  viewSwitcher.appendChild(title);
  
  // 创建按钮容器
  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'view-button-group';
  
  // 为每个视图创建按钮
  Object.entries(MAP_VIEWS).forEach(([key, view]) => {
    const btn = document.createElement('button');
    btn.className = 'view-button';
    btn.dataset.view = key;
    if (key === savedView) {
      btn.classList.add('active');
    }
    btn.innerHTML = `${view.icon} ${view.name}`;
    
    btn.addEventListener('click', () => {
      // 移除所有按钮的active类
      buttonGroup.querySelectorAll('.view-button').forEach(b => b.classList.remove('active'));
      // 添加当前按钮的active类
      btn.classList.add('active');
      // 应用视图
      applyMapView(key);
    });
    
    buttonGroup.appendChild(btn);
  });
  
  viewSwitcher.appendChild(buttonGroup);
  
  // 插入到页面（在底图样式选择器之前）
  const panel = document.querySelector('#panel');
  const firstCard = panel?.querySelector('.card');
  if (firstCard) {
    firstCard.parentNode.insertBefore(viewSwitcher, firstCard);
  }
  
  // 应用初始视图
  applyMapView(savedView);
}

const els = {
  typeFilters: document.getElementById('type-filters'),
  typeAllBtn: document.getElementById('type-all'),
  typeNoneBtn: document.getElementById('type-none'),
  roadToggle: document.getElementById('road-toggle'),
  roadSearch: document.getElementById('road-search'),
  roadFilters: document.getElementById('road-filters'),
  roadStatus: document.getElementById('road-status'),
  roadAllBtn: document.getElementById('road-all'),
  roadNoneBtn: document.getElementById('road-none'),
  corridorKm: document.getElementById('corridor-km'),
  roadPointFilter: document.getElementById('road-point-filter'),
  fitBtn: document.getElementById('btn-fit'),
  exportCsvBtn: document.getElementById('btn-export-csv'),
  nameSearch: document.getElementById('name-search'),
  labelService: document.getElementById('label-service'),
  labelAll: document.getElementById('label-all'),
  labelNone: document.getElementById('label-none'),
  trustedOnly: document.getElementById('trusted-only'),
  status: document.getElementById('status'),
  stats: document.getElementById('stats'),
  dropSummary: document.getElementById('drop-summary'),
  resultList: document.getElementById('result-list')
};

const state = {
  activeTypes: new Set(),
  items: [],
  markers: [],
  labels: [],
  roadLines: [],
  roadRoutes: [],
  selectedRoadRoutes: new Set(),
  roadInfoWindow: null,
  infoWindow: null,
  countyPolygons: [],
  terrainPolygons: []  // 地形多边形
};

const map = new AMap.Map('map', {
  center: [106.72, 26.58],
  zoom: 7.1,
  viewMode: '2D',
  mapStyle: 'amap://styles/normal',
  features: ['bg', 'road', 'point']
});

AMap.plugin(['AMap.Scale', 'AMap.ToolBar'], () => {
  map.addControl(new AMap.Scale());
  map.addControl(new AMap.ToolBar({ position: 'RB' }));
});

state.infoWindow = new AMap.InfoWindow({ offset: new AMap.Pixel(0, -22) });
state.roadInfoWindow = new AMap.InfoWindow({ offset: new AMap.Pixel(0, -8) });

function setStatus(text) {
  els.status.textContent = text;
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function getLocation(item) {
  const loc = item.location || item.position || item.lnglat;
  if (loc && typeof loc === 'object') {
    const lng = toNumber(loc.lng ?? loc.longitude ?? loc[0]);
    const lat = toNumber(loc.lat ?? loc.latitude ?? loc[1]);
    if (lng != null && lat != null) return { lng, lat };
  }

  const lng = toNumber(item.lng ?? item.longitude);
  const lat = toNumber(item.lat ?? item.latitude);
  if (lng != null && lat != null) return { lng, lat };
  return null;
}

function inGuizhou(location) {
  return location.lng >= GUIZHOU_BOUNDS.minLng &&
    location.lng <= GUIZHOU_BOUNDS.maxLng &&
    location.lat >= GUIZHOU_BOUNDS.minLat &&
    location.lat <= GUIZHOU_BOUNDS.maxLat;
}

function inferType(item) {
  const text = `${item.typeId || ''}${item.type || ''}${item.typeLabel || ''}${item.sourceKeyword || ''}${item.name || ''}`;
  if (/高速服务区/.test(text)) return 'highway_service_area';
  if (/服务区/.test(text)) return 'service_area';
  if (/休息区|停车区/.test(text)) return 'rest_area';
  if (/收费站/.test(text)) return 'toll_station';
  if (/加油站|加能站|油站/.test(text)) return 'gas_station';
  return TYPE_BY_ID[item.typeId] ? item.typeId : 'service_area';
}

function normalizeItem(item, index) {
  const location = getLocation(item);
  if (!location) return null;
  const typeId = inferType(item);
  const type = TYPE_BY_ID[typeId];
  const warnings = Array.isArray(item.warnings) ? item.warnings.slice() : [];
  if (!inGuizhou(location)) warnings.push('坐标不在贵州范围');

  return {
    id: item.id || `poi-${index}`,
    name: item.name || item.title || '未命名点位',
    typeId,
    typeLabel: type.label,
    address: item.address || item.formatted_address || '',
    district: item.district || item.city || item.sourceCity || '',
    location,
    sourceKeyword: item.sourceKeyword || item.keyword || '',
    sources: Array.isArray(item.sources) ? item.sources : [],
    trusted: item.trusted !== false && warnings.length === 0,
    warnings: Array.from(new Set(warnings))
  };
}

function normalizeDataset(data) {
  const rawItems = Array.isArray(data.items) ? data.items : [];
  return rawItems
    .map(normalizeItem)
    .filter(Boolean)
    .sort((a, b) => TYPE_BY_ID[b.typeId].priority - TYPE_BY_ID[a.typeId].priority || a.name.localeCompare(b.name, 'zh'));
}

async function loadDataset() {
  try {
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const items = normalizeDataset(data);
    if (!items.length) throw new Error('数据文件里没有可绘制点位');
    state.items = items;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ items: state.items }));
    } catch (error) {
      console.warn('cache save failed', error);
    }
    renderAll();
    setStatus(`已加载点位数据：${items.length} 个点位。请勾选类型筛选以显示点位。`);
    return;
  } catch (error) {
    console.warn('dataset file load failed', error);
  }

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) throw new Error('no cache');
    const items = normalizeDataset(JSON.parse(cached));
    if (!items.length) throw new Error('cache empty');
    state.items = items;
    renderAll();
    setStatus(`未找到数据文件，已从浏览器缓存加载 ${items.length} 个点位。请勾选类型筛选以显示点位。`);
  } catch (error) {
    console.warn('dataset cache load failed', error);
    state.items = [];
    renderAll();
    setStatus(`未加载到点位数据：请先生成 ${DATA_URL}。`);
  }
}

async function loadRoadNetwork() {
  try {
    const response = await fetch(ROAD_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const features = Array.isArray(data.features) ? data.features : [];
    state.roadLines.forEach(line => line.setMap(null));
    state.roadLines = features
      .map(makeRoadLine)
      .filter(Boolean);
    buildRoadRoutes();
    renderRoadFilters();
    // 初始隐藏所有路网
    state.roadLines.forEach(line => line.hide());
    applyRoadVisibility();
  } catch (error) {
    console.warn('road network load failed', error);
  }
}

function routeKeysFromProps(props) {
  const keys = new Set();
  // 提取ref中的每个编号（如 "G60;G76" -> ["G60", "G76"]）
  const refs = String(props.ref || '')
    .split(';')
    .map(item => item.trim())
    .filter(Boolean);
  
  // 为每个ref创建独立的key，这样搜索G60时能匹配到G60;G76的线段
  refs.forEach(ref => keys.add(`ref:${ref}`));
  
  // 如果ref为空，使用name作为key
  if (!refs.length && props.name) {
    keys.add(`name:${props.name}`);
  }
  
  return Array.from(keys);
}

function makeRoadLine(feature) {
  const geometry = feature.geometry || {};
  const coords = geometry.type === 'LineString'
    ? geometry.coordinates
    : geometry.type === 'MultiLineString'
      ? geometry.coordinates
      : null;
  if (!Array.isArray(coords) || !coords.length) return null;
  const props = feature.properties || {};
  const path = geometry.type === 'MultiLineString'
    ? coords
        .filter(part => Array.isArray(part) && part.length >= 2)
        .map(part => part.map(coord => [coord[0], coord[1]]))
    : coords.map(coord => [coord[0], coord[1]]);
  const paths = geometry.type === 'MultiLineString' ? path : [path];
  if (!paths.length || paths.every(part => part.length < 2)) return null;
  const allCoords = paths.flat();
  const lineOptions = {
    strokeColor: '#1e88e5',  // 更醒目的蓝色
    strokeOpacity: 0.85,     // 提高透明度
    strokeWeight: 4,         // 增加线条粗细
    strokeStyle: 'solid',
    lineJoin: 'round',
    lineCap: 'round',
    zIndex: 50,              // 提高层级，确保在POI点位下方但在底图上方
    map: map
  };
  const overlays = paths.map(part => new AMap.Polyline({
    ...lineOptions,
    path: part
  }));
  const roadLine = {
    overlays,
    setMap(targetMap) {
      overlays.forEach(line => line.setMap(targetMap));
    },
    show() {
      overlays.forEach(line => line.show());
    },
    hide() {
      overlays.forEach(line => line.hide());
    }
  };
  roadLine.meta = {
    name: props.name || '',
    ref: props.ref || '',
    label: props.roadLabel || '高速公路',
    routeKeys: routeKeysFromProps(props),
    path,
    paths,
    bbox: allCoords.reduce((box, coord) => ({
      minLng: Math.min(box.minLng, coord[0]),
      maxLng: Math.max(box.maxLng, coord[0]),
      minLat: Math.min(box.minLat, coord[1]),
      maxLat: Math.max(box.maxLat, coord[1])
    }), { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity })
  };
  overlays.forEach(line => line.on('click', event => {
    const title = roadLine.meta.name || roadLine.meta.ref || roadLine.meta.label;
    const content = `<div style="min-width:180px;font-size:13px;line-height:1.5;">
      <div style="font-weight:700;margin-bottom:4px;">${title}</div>
      <div>类型：${roadLine.meta.label}</div>
      ${roadLine.meta.ref ? `<div>编号：${roadLine.meta.ref}</div>` : ''}
    </div>`;
    state.roadInfoWindow.setContent(content);
    state.roadInfoWindow.open(map, event.lnglat || allCoords[0]);
  }));
  roadLine.setMap(map);
  return roadLine;
}

function buildRoadRoutes() {
  const routeMap = new Map();
  state.roadLines.forEach(line => {
    line.meta.routeKeys.forEach(key => {
      if (!routeMap.has(key)) {
        const [kind, value] = key.split(':');
        routeMap.set(key, {
          key,
          kind,
          value,
          names: new Set(),
          refs: new Set(),
          lineCount: 0,
          pointCount: 0
        });
      }
      const route = routeMap.get(key);
      if (line.meta.name) route.names.add(line.meta.name);
      if (line.meta.ref) {
        line.meta.ref.split(';').map(item => item.trim()).filter(Boolean).forEach(ref => route.refs.add(ref));
      }
      route.lineCount += 1;
      route.pointCount += line.meta.paths.reduce((total, path) => total + path.length, 0);
    });
  });

  state.roadRoutes = Array.from(routeMap.values())
    .map(route => ({
      ...route,
      namesText: Array.from(route.names).join(' / '),
      refsText: Array.from(route.refs).join(' / ')
    }))
    .sort((a, b) => a.value.localeCompare(b.value, 'zh'));
  state.selectedRoadRoutes = new Set();
}

function routeLabel(route) {
  if (route.kind === 'ref' && route.namesText) return `${route.value} · ${route.namesText}`;
  return route.value;
}

function selectedAllRoads() {
  return state.roadRoutes.length > 0 && state.selectedRoadRoutes.size === state.roadRoutes.length;
}

function roadLineMatchesSelection(line) {
  if (!state.roadRoutes.length || state.selectedRoadRoutes.size === 0) return false;
  return line.meta.routeKeys.some(key => state.selectedRoadRoutes.has(key));
}

function routeMatchesQuery(route, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const routeValue = String(route.value || '').toLowerCase();
  const refs = route.refsText
    .split('/')
    .map(ref => ref.trim().toLowerCase())
    .filter(Boolean);

  if (route.kind === 'ref' && (routeValue === q || refs.includes(q))) return true;
  if (/^[a-z]\d+$/i.test(query)) return false;
  return route.namesText.toLowerCase().includes(q);
}

function renderRoadFilters() {
  if (!els.roadFilters) return;
  const q = els.roadSearch ? els.roadSearch.value.trim().toLowerCase() : '';
  const visibleRoutes = state.roadRoutes.filter(route => routeMatchesQuery(route, q));

  els.roadFilters.innerHTML = visibleRoutes.map(route => `
    <label class="road-chip" title="${routeLabel(route)}">
      <input type="checkbox" data-route="${route.key}" ${state.selectedRoadRoutes.has(route.key) ? 'checked' : ''} />
      <span class="road-chip-name">${routeLabel(route)}</span>
      <span class="road-chip-count">${route.lineCount}</span>
    </label>
  `).join('') || '<div class="status">无匹配高速</div>';

  els.roadFilters.querySelectorAll('input[data-route]').forEach(input => {
    input.addEventListener('change', () => {
      if (input.checked) state.selectedRoadRoutes.add(input.dataset.route);
      else state.selectedRoadRoutes.delete(input.dataset.route);
      if (state.selectedRoadRoutes.size > 0) {
        els.roadToggle.checked = true;
      } else {
        els.roadToggle.checked = false;
      }
      applyRoadVisibility();
      applyFilters();
    });
  });
}

function applyRoadVisibility() {
  const visible = !els.roadToggle || els.roadToggle.checked;
  let visibleCount = 0;

  state.roadLines.forEach(line => {
    if (visible && roadLineMatchesSelection(line)) {
      line.show();
      visibleCount += 1;
    } else {
      line.hide();
    }
  });
  if (els.roadStatus) {
    const selectedCount = selectedAllRoads() ? state.roadRoutes.length : state.selectedRoadRoutes.size;
    if (!state.roadRoutes.length) {
      els.roadStatus.textContent = '高速路网加载中…';
    } else if (state.selectedRoadRoutes.size === 0) {
      els.roadStatus.textContent = '未选择高速，勾选路线后显示路网和沿线点位';
    } else {
      els.roadStatus.textContent = `高速：${selectedCount}/${state.roadRoutes.length} 条，显示线段 ${visibleCount}/${state.roadLines.length}`;
    }
  }
}

function coordToLngLat(coord) {
  if (Array.isArray(coord)) return { lng: Number(coord[0]), lat: Number(coord[1]) };
  return {
    lng: Number(coord.lng ?? coord.getLng?.()),
    lat: Number(coord.lat ?? coord.getLat?.())
  };
}

function lngLatToMeters(location, originLat) {
  // 使用相对坐标计算，避免大数值精度问题
  const centerLng = 106.72;  // 贵州中心经度
  const centerLat = 26.58;   // 贵州中心纬度
  
  const latScale = 111320;  // 纬度每度约 111.32km
  const lngScale = 111320 * Math.cos(originLat * Math.PI / 180);  // 经度随纬度变化
  
  // 计算相对于贵州中心的偏移（米）
  return {
    x: (location.lng - centerLng) * lngScale,
    y: (location.lat - centerLat) * latScale
  };
}

function pointSegmentDistanceMeters(point, a, b) {
  const originLat = point.lat;
  const start = coordToLngLat(a);
  const end = coordToLngLat(b);
  const p = lngLatToMeters(point, originLat);
  const p1 = lngLatToMeters(start, originLat);
  const p2 = lngLatToMeters(end, originLat);
  let dx = p2.x - p1.x;
  let dy = p2.y - p1.y;
  if (dx === 0 && dy === 0) {
    dx = p.x - p1.x;
    dy = p.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  const t = Math.max(0, Math.min(1, ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / (dx * dx + dy * dy)));
  const x = p1.x + t * dx;
  const y = p1.y + t * dy;
  dx = p.x - x;
  dy = p.y - y;
  return Math.sqrt(dx * dx + dy * dy);
}

function pointLineDistanceMeters(point, path) {
  let min = Infinity;
  for (let i = 1; i < path.length; i += 1) {
    const distance = pointSegmentDistanceMeters(point, path[i - 1], path[i]);
    if (distance < min) min = distance;
  }
  return min;
}

function pointInExpandedBbox(point, bbox, thresholdMeters) {
  const latBuffer = thresholdMeters / 111320;
  const lngBuffer = thresholdMeters / (111320 * Math.cos(point.lat * Math.PI / 180));
  return point.lng >= bbox.minLng - lngBuffer &&
    point.lng <= bbox.maxLng + lngBuffer &&
    point.lat >= bbox.minLat - latBuffer &&
    point.lat <= bbox.maxLat + latBuffer;
}

function selectedRoadLinesForPointFilter() {
  if (!els.roadPointFilter || !els.roadPointFilter.checked) return [];
  if (!state.roadRoutes.length || state.selectedRoadRoutes.size === 0) return [];
  return state.roadLines.filter(roadLineMatchesSelection);
}

function pointNearSelectedRoads(item, selectedLines) {
  if (!els.roadPointFilter || !els.roadPointFilter.checked) return true;
  if (!state.roadRoutes.length || state.selectedRoadRoutes.size === 0) return true;
  if (!selectedLines.length) return false;
  const threshold = Math.max(0.5, Number(els.corridorKm?.value || 3)) * 1000;
  return selectedLines.some(line => {
    if (!pointInExpandedBbox(item.location, line.meta.bbox, threshold)) return false;
    return line.meta.paths.some(path => pointLineDistanceMeters(item.location, path) <= threshold);
  });
}

function markerHtml(item) {
  const color = TYPE_BY_ID[item.typeId].color;
  const serviceClass = item.typeId.includes('service_area') ? ' is-service' : '';
  const trustedClass = item.trusted ? '' : ' is-untrusted';
  return `<div class="poi-marker${serviceClass}${trustedClass}" style="background:${color}"></div>`;
}

function infoHtml(item) {
  const warning = item.warnings.length ? `<div style="color:#b54b2d;margin-top:5px;">提示：${item.warnings.join('、')}</div>` : '';
  const source = item.sources.length ? `<div>来源：${item.sources.join('；')}</div>` : '';
  return `
    <div style="min-width:220px;font-size:13px;line-height:1.55;">
      <div style="font-weight:700;margin-bottom:4px;">${item.name}</div>
      <div>类型：${item.typeLabel}</div>
      <div>坐标：${item.location.lng.toFixed(6)}, ${item.location.lat.toFixed(6)}</div>
      ${item.district ? `<div>地区：${item.district}</div>` : ''}
      ${item.address ? `<div>地址：${item.address}</div>` : ''}
      ${source}
      ${warning}
    </div>
  `;
}

function makeMarker(item) {
  const position = [item.location.lng, item.location.lat];
  const marker = new AMap.Marker({
    position,
    content: markerHtml(item),
    offset: new AMap.Pixel(-7, -7),
    zIndex: TYPE_BY_ID[item.typeId].priority
  });

  const label = new AMap.Text({
    text: item.name,
    position,
    offset: new AMap.Pixel(0, -20),
    anchor: 'center',
    zIndex: 80,
    style: {
      background: 'rgba(255,255,255,0.92)',
      border: '1px solid #d8e1e4',
      borderRadius: '8px',
      padding: '2px 7px',
      color: '#172025',
      fontSize: '12px',
      lineHeight: '1.25',
      whiteSpace: 'nowrap',
      boxShadow: '0 6px 14px rgba(25,42,47,0.16)'
    }
  });

  marker.item = item;
  label.item = item;
  marker.label = label;
  marker.on('click', () => showInfo(item));
  label.on('click', () => showInfo(item));
  marker.setMap(map);
  label.setMap(map);
  return { marker, label };
}

function showInfo(item) {
  state.infoWindow.setContent(infoHtml(item));
  state.infoWindow.open(map, [item.location.lng, item.location.lat]);
}

function clearOverlays() {
  state.markers.forEach(marker => marker.setMap(null));
  state.labels.forEach(label => label.setMap(null));
  state.markers = [];
  state.labels = [];
}

function itemVisible(item, selectedLines = selectedRoadLinesForPointFilter()) {
  if (!state.activeTypes.has(item.typeId)) return false;
  if (els.trustedOnly.checked && !item.trusted) return false;
  if (!pointNearSelectedRoads(item, selectedLines)) return false;
  const q = els.nameSearch.value.trim();
  if (q && !`${item.name}${item.address}${item.district}`.includes(q)) return false;
  return true;
}

function labelVisible(item, selectedLines = selectedRoadLinesForPointFilter()) {
  if (!itemVisible(item, selectedLines)) return false;
  
  // 根据单选框决定显示哪些标签
  if (els.labelAll.checked) return true;  // 显示全部
  if (els.labelNone.checked) return false;  // 隐藏全部
  // 默认：显示服务区名称
  return els.labelService.checked && (item.typeId === 'highway_service_area' || item.typeId === 'service_area');
}

function applyFilters() {
  let visible = 0;
  const selectedLines = selectedRoadLinesForPointFilter();
  state.markers.forEach(marker => {
    if (itemVisible(marker.item, selectedLines)) {
      marker.show();
      visible += 1;
    } else {
      marker.hide();
    }
  });
  state.labels.forEach(label => {
    if (labelVisible(label.item, selectedLines)) label.show();
    else label.hide();
  });
  updateStats(visible);
  renderResultList();
}

function renderMarkers() {
  clearOverlays();
  state.items.forEach(item => {
    // 只创建已选中类型的 marker
    if (!state.activeTypes.has(item.typeId)) return;
    
    const overlay = makeMarker(item);
    state.markers.push(overlay.marker);
    state.labels.push(overlay.label);
  });
  applyFilters();
  fitVisible();
}

function renderAll() {
  renderMarkers();
  renderResultList();
  updateStats(state.items.length);
}

function updateStats(visibleCount) {
  const byType = POI_TYPES.map(type => ({
    ...type,
    count: state.items.filter(item => item.typeId === type.id).length
  }));
  const totalTrusted = state.items.filter(item => item.trusted).length;
  const abnormal = state.items.length - totalTrusted;
  els.stats.innerHTML = `
    <div class="stat"><strong>${state.items.length}</strong><span>点位数据</span></div>
    <div class="stat"><strong>${visibleCount ?? state.items.length}</strong><span>当前显示</span></div>
    <div class="stat"><strong>${totalTrusted}</strong><span>可信点位</span></div>
    <div class="stat"><strong>${abnormal}</strong><span>异常隐藏</span></div>
    ${byType.map(type => `<div class="stat"><strong>${type.count}</strong><span>${type.label}</span></div>`).join('')}
  `;
  els.dropSummary.textContent = abnormal ? `有 ${abnormal} 个点位带异常提示，默认隐藏。` : '';
}

function renderResultList() {
  const selectedLines = selectedRoadLinesForPointFilter();
  const visibleItems = state.items.filter(item => itemVisible(item, selectedLines)).slice(0, 180);
  els.resultList.innerHTML = visibleItems.map(item => {
    const type = TYPE_BY_ID[item.typeId];
    const warning = item.trusted ? '' : ` · ${item.warnings.join('、')}`;
    return `
      <div class="result-item" data-id="${item.id}">
        <div class="result-name"><span class="swatch" style="background:${type.color}"></span>${item.name}</div>
        <div class="result-meta">${item.typeLabel} · ${item.district || '-'} · ${item.location.lng.toFixed(5)}, ${item.location.lat.toFixed(5)}${warning}</div>
      </div>
    `;
  }).join('') || '<div class="status">暂无点位</div>';

  els.resultList.querySelectorAll('.result-item').forEach((row, index) => {
    row.addEventListener('click', () => {
      const item = visibleItems[index];
      map.setZoomAndCenter(13, [item.location.lng, item.location.lat]);
      showInfo(item);
    });
  });
}

function fitVisible() {
  const selectedLines = selectedRoadLinesForPointFilter();
  const visibleMarkers = state.markers.filter(marker => itemVisible(marker.item, selectedLines));
  const visibleRoads = state.roadLines.filter(line => els.roadToggle.checked && roadLineMatchesSelection(line));
  const overlays = visibleMarkers.length
    ? visibleMarkers
    : visibleRoads.flatMap(line => line.overlays);
  if (overlays.length) map.setFitView(overlays, false, [60, 60, 60, 60], 12);
}

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv() {
  const header = ['名称', '类型', '经度', '纬度', '地区', '地址', '可信', '提示'];
  const rows = state.items.map(item => [
    item.name,
    item.typeLabel,
    item.location.lng,
    item.location.lat,
    item.district,
    item.address,
    item.trusted ? '是' : '否',
    item.warnings.join(';')
  ]);
  const csv = [header, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'guizhou_expressway_pois.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildControls() {
  els.typeFilters.innerHTML = POI_TYPES.map(type => `
    <label class="chip">
      <input type="checkbox" data-type="${type.id}" />
      <span class="swatch" style="background:${type.color}"></span>
      ${type.label}
    </label>
  `).join('');

  els.typeFilters.querySelectorAll('input[data-type]').forEach(input => {
    input.addEventListener('change', () => {
      if (input.checked) state.activeTypes.add(input.dataset.type);
      else state.activeTypes.delete(input.dataset.type);
      // 重新渲染 markers（因为 renderMarkers 中做了筛选）
      renderMarkers();
    });
  });
}

function bindEvents() {
  els.fitBtn.addEventListener('click', fitVisible);
  els.exportCsvBtn.addEventListener('click', exportCsv);
  
  // POI类型全选/清空
  els.typeAllBtn.addEventListener('click', () => {
    POI_TYPES.forEach(type => state.activeTypes.add(type.id));
    // 更新所有复选框状态
    els.typeFilters.querySelectorAll('input[data-type]').forEach(input => {
      input.checked = true;
    });
    renderMarkers();
  });
  
  els.typeNoneBtn.addEventListener('click', () => {
    state.activeTypes.clear();
    // 更新所有复选框状态
    els.typeFilters.querySelectorAll('input[data-type]').forEach(input => {
      input.checked = false;
    });
    renderMarkers();
  });
  
  els.roadToggle.addEventListener('change', () => {
    if (els.roadToggle.checked && state.selectedRoadRoutes.size === 0 && state.roadRoutes.length > 0) {
      state.selectedRoadRoutes = new Set(state.roadRoutes.map(route => route.key));
      renderRoadFilters();
    }
    applyRoadVisibility();
    applyFilters();
  });
  els.roadSearch.addEventListener('input', () => {
    // 当用户输入搜索词时，自动选中匹配的路线
    const q = els.roadSearch.value.trim();
    if (q) {
      state.roadRoutes.forEach(route => {
        if (routeMatchesQuery(route, q)) {
          state.selectedRoadRoutes.add(route.key);
        } else {
          state.selectedRoadRoutes.delete(route.key);
        }
      });
      // 如果有匹配的路线，自动打开路网显示
      if (state.selectedRoadRoutes.size > 0) {
        els.roadToggle.checked = true;
      }
      renderRoadFilters();
      applyRoadVisibility();
      applyFilters();
    } else {
      // 清空搜索时，保持当前选中状态
      renderRoadFilters();
      applyRoadVisibility();
      applyFilters();
    }
  });
  els.roadAllBtn.addEventListener('click', () => {
    state.selectedRoadRoutes = new Set(state.roadRoutes.map(route => route.key));
    els.roadToggle.checked = true;
    renderRoadFilters();
    applyRoadVisibility();
    applyFilters();
  });
  els.roadNoneBtn.addEventListener('click', () => {
    state.selectedRoadRoutes.clear();
    els.roadToggle.checked = false;
    renderRoadFilters();
    applyRoadVisibility();
    applyFilters();
  });
  [els.corridorKm, els.roadPointFilter].forEach(el => {
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  });
  [els.nameSearch, els.trustedOnly].forEach(el => {
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  });
  // 标签显示模式（单选框）
  [els.labelService, els.labelAll, els.labelNone].forEach(el => {
    el.addEventListener('change', applyFilters);
  });
}

async function loadGeoJSON(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  return response.json();
}

function toPolygonPaths(geometry) {
  const paths = [];
  if (geometry.type === 'Polygon') {
    paths.push(geometry.coordinates);
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach(polygon => paths.push(polygon));
  }
  return paths;
}

function normalizePath(rings) {
  return rings.map(ring => ring.map(coord => [coord[0], coord[1]]));
}

async function loadBoundaryMask() {
  try {
    const boundary = await loadGeoJSON(BOUNDARY_URL);
    const geom = boundary.features[0].geometry;
    const paths = [];
    toPolygonPaths(geom).forEach(rings => {
      paths.push(normalizePath(rings));
    });
    if (paths.length > 0) map.setMask(paths);
    console.log('贵州省边界遮罩已加载');
  } catch (error) {
    console.warn('boundary load failed', error);
  }
}

async function loadCountyOutlines() {
  try {
    const geo = await loadGeoJSON(COUNTIES_URL);
    const features = geo.features || [];

    features.forEach(feature => {
      const pathsList = toPolygonPaths(feature.geometry);

      pathsList.forEach(rings => {
        const path = normalizePath(rings);
        const poly = new AMap.Polygon({
          path,
          strokeColor: '#334155',
          strokeWeight: 1,
          strokeOpacity: 0.5,
          fillColor: '#ffffff',
          fillOpacity: 0,
          zIndex: 10,
          bubble: true
        });
        poly.setMap(map);
        state.countyPolygons.push(poly);
      });
    });
    console.log(`县区轮廓已加载：${features.length} 个县区`);
  } catch (error) {
    console.warn('county outlines load failed', error);
  }
}

/**
 * 加载贵州地形数据（山区显示）
 */
async function loadTerrainLayer() {
  try {
    console.log('🗻 正在加载地形数据...');
    
    // 确保map对象已就绪
    if (!map) {
      console.error('❌ map对象未初始化');
      return;
    }
    
    const terrainGeo = await loadGeoJSON(TERRAIN_URL);
    const features = terrainGeo.features || [];
    
    console.log(`✅ 地形数据已加载：${features.length} 个山区多边形`);
    
    if (features.length === 0) {
      console.warn('⚠️ 地形数据为空');
      return;
    }
    
    // 创建山区填充多边形
    let count = 0;
    features.forEach(feature => {
      const pathsList = toPolygonPaths(feature.geometry);
      
      pathsList.forEach(rings => {
        const path = normalizePath(rings);
        const terrainPoly = new AMap.Polygon({
          path,
          strokeColor: '#22c55e',  // 绿色边框
          strokeWeight: 1,
          strokeOpacity: 0.6,
          fillColor: '#86efac',    // 浅绿色填充（山地）
          fillOpacity: 0.4,        // 半透明，可以看到底图
          zIndex: 5,               // 在县区轮廓下方
          bubble: false            // 不响应鼠标事件
        });
        terrainPoly.setMap(map);
        state.terrainPolygons.push(terrainPoly);
        count++;
      });
    });
    
    console.log(`✅ 地形图层渲染完成，共 ${count} 个多边形`);
  } catch (error) {
    console.error(' 地形图层加载失败:', error);
    console.error('错误详情:', error.stack);
  }
}

/**
 * 根据底图样式更新所有覆盖层的颜色
 */
function updateOverlaysForStyle(styleName) {
  const colors = OVERLAY_COLORS[styleName] || OVERLAY_COLORS.default;
  
  // 更新县区轮廓颜色
  if (state.countyPolygons && state.countyPolygons.length > 0) {
    state.countyPolygons.forEach(poly => {
      poly.setOptions({
        strokeColor: colors.strokeColor,
        strokeOpacity: colors.strokeOpacity
      });
    });
    console.log(`县区轮廓颜色已更新为：${colors.label}风格`);
  }
  
  // 边界遮罩通过高德API的mask设置，颜色由底图样式控制
  // 如果需要自定义遮罩颜色，可以重新调用loadBoundaryMask()
  console.log(`底图样式切换为：${colors.label}，覆盖层颜色已自动适配`);
}

function init() {
  if (!window.AMap) {
    setStatus('高德地图加载失败，请检查网络与 Key。');
    return;
  }
  initMapViewSwitcher();     // 初始化视图模式切换
  initMapStyleSelector();    // 初始化底图样式选择器
  buildControls();
  bindEvents();
  renderAll();
  loadRoadNetwork();
  loadDataset();
  loadBoundaryMask();
  loadCountyOutlines();
  loadTerrainLayer();        // 加载地形图层（山区显示）
}

init();
