# 贵州高速服务设施地图项目接手说明

## 项目目标

本项目用于制作贵州省高速服务设施概念性布局图。地图展示贵州高速路网，并叠加高速服务区、服务区、加油站、休息区、收费站等点位，用于人工研判“哪些服务区/沿线节点需要布局什么设施”。

核心原则：**点位数据获取** 和 **地图显示** 是两件独立的事。

## 当前目录

工作目录：

```text
D:\worksapces\guizhojiaotong
```

主要文件：

```text
index.html                         主地图页面
css/style.css                      页面样式
js/app.js                          地图显示、筛选、路网/点位交互逻辑
data/guizhou_expressway_pois.json  已获取的点位数据
data/guizhou_roads.geojson         已获取的贵州高速路网数据
tools/collect_amap_pois.mjs        页面外获取高德 POI 点位数据
tools/amap_poi_collect.html        高德 JSAPI 点位获取辅助页
tools/amap_poi_collect.js          高德 JSAPI 点位获取逻辑
tools/collect_osm_roads.mjs        页面外获取 OSM 高速路网数据
start_map.ps1                      本地 HTTP 服务启动脚本
README.md                          面向使用者的说明
```

## 当前功能状态

主地图页面已经实现：

- 读取 `data/guizhou_expressway_pois.json` 显示点位。
- 读取 `data/guizhou_roads.geojson` 显示贵州高速路网。
- 点位按类型筛选：高速服务区、服务区、加油站、休息区、收费站。
- 服务区名称默认显示；可切换显示全部名称。
- 可隐藏明显异常点。
- 高速路线筛选：可按编号/名称搜索，例如 `G60`、`沪昆`。
- 默认高速路线全不选中，默认不显示高速路网。
- 勾选某条高速后，自动打开高速路网，并只显示该高速线。
- 勾选一条或多条高速后，点位可限制在所选高速沿线范围内。
- 沿线范围默认 `3 km`，可在页面调整。
- 可导出当前点位 CSV。

## 数据状态

点位数据：

- 文件：`data/guizhou_expressway_pois.json`
- 来源：高德 JSAPI `AMap.PlaceSearch`
- 获取方式：页面外脚本 `node tools\collect_amap_pois.mjs`
- 当前结果：清洗后约 `1893` 个点位
- 点位类别：高速服务区、服务区、加油站、休息区、收费站

高速路网：

- 文件：`data/guizhou_roads.geojson`
- 来源：OpenStreetMap Overpass API
- 获取方式：页面外脚本 `node tools\collect_osm_roads.mjs`
- 当前只保留：`highway=motorway`
- 当前结果：合并抽稀后 `307` 条高速线段
- 坐标：已从 WGS84 转换为 GCJ-02，适合叠加高德地图

## 重要设计约束

1. 不要把点位获取功能放回主地图页面。
2. 主地图页面只负责读取现成数据文件并显示。
3. 点位获取和路网获取都属于页面外的数据准备动作。
4. 高德 Key 来自参考项目，写在 `index.html` 和 `tools/amap_poi_collect.html`：

```text
key=63012397200899138fc66edc8f54a72a
securityJsCode=1acf31e6fec21ecda33981b3f9972b2f
```

5. 高德 REST Web Service 不能直接用这个 Key，之前试过会返回 `USERKEY_PLAT_NOMATCH`，说明它是 JSAPI 平台 Key。
6. 主页面必须通过 HTTP 服务访问，不建议直接双击 `index.html`，因为浏览器会限制 `file://` 下读取本地 JSON。

## 运行方式

当前运行：

```powershell
cd D:\worksapces\guizhojiaotong
.\start_map.ps1
```

访问：

```text
http://localhost:8010/index.html
```

如果别人电脑上没有 Python，当前 `start_map.ps1` 无法启动本地服务。后续打包给别人用时，建议补一个更友好的 `start_map.bat`，或做一个不依赖 Python 的轻量启动器。

## 重新获取数据

重新获取点位数据：

```powershell
node tools\collect_amap_pois.mjs
```

重新获取高速路网：

```powershell
node tools\collect_osm_roads.mjs
```

注意：这两个动作会覆盖 `data/` 下对应数据文件。除非用户明确要求刷新数据，否则不要随便重跑。

## 最近一次关键决策

- 用户明确纠正：`获取点位数据` 和 `显示地图` 是两件事，不能混在主页面里。
- 用户要求：高速路网只要高速，不要国道、省道、主干路等。
- 用户要求：路线筛选默认都不选中。
- 用户反馈：显示路网“点完没反应”。已修复为：
  - 勾选路线时自动打开路网显示；
  - 点“显示高速路网”但未选择路线时自动全选高速；
  - 点“清空高速”时关闭路网；
  - 沿线点位筛选加入包围盒预过滤，避免点击后卡顿。

## 已知问题和风险

- 当前底图依赖在线高德 JSAPI，不是完全离线。
- 如果高德 Key 的域名白名单限制不含对方使用环境，地图会加载失败。
- 如果对方网络不能访问高德，底图会加载失败。
- OSM 路网数据不是官方交通厅数据，适合概念性布局，不适合精确工程制图。
- 路线名称/编号来自 OSM，部分路线可能存在复合编号、缺名、别名混杂。
- 当前“高速条数”按路网 `ref/name` 去重估算约 `64` 条，不是官方口径。

## 建议后续工作

1. 打包分发前增加 `start_map.bat`。
2. 增加 `README_OFFLINE.txt`，用一句话告诉普通用户：解压后双击启动脚本，不要直接打开 `index.html`。
3. 如果要完全免安装，考虑做一个 Windows 小启动器或内置轻量 HTTP 服务。
4. 如果要正式汇报，建议在图上增加标题、图例和截图模式。
5. 如果对某条高速沿线点位要求更准，可以人工校核对应高速的服务区/收费站清单。
