# 贵州高速服务设施 POI 地图

这是一个独立静态工具，用点位数据绘制贵州省高速服务设施地图。获取点位数据和地图显示是两件独立的事：点位数据由高德 API 单独获取并写入 `data/guizhou_expressway_pois.json`，主页面只负责加载、筛选和出图。

## 功能

- 数据：启动时读取 `data/guizhou_expressway_pois.json`。
- 路网：读取 `data/guizhou_roads.geojson` 显示贵州高速路网。
- 类型：点位不同颜色标记，可按类型筛选。
- 标签：默认显示服务区名称，可切换显示全部名称。
- 输出：可导出当前点位 CSV，方便人工核对。

## 运行

```powershell
cd D:\worksapces\guizhojiaotong
.\start_map.ps1
```

打开后访问：

```text
http://localhost:8010/index.html
```

## 获取点位数据

当前点位数据文件是 `data/guizhou_expressway_pois.json`。如后续确实需要重新获取点位数据，在页面外执行：

```powershell
node tools\collect_amap_pois.mjs
```

该脚本会调用高德 JSAPI，生成新的 `data/guizhou_expressway_pois.json`。主地图页面不负责获取点位，只负责读取这个文件并显示。

## 获取高速路网

当前高速路网文件是 `data/guizhou_roads.geojson`。如后续需要重新获取，在页面外执行：

```powershell
node tools\collect_osm_roads.mjs
```

该脚本会从 OpenStreetMap Overpass API 获取贵州范围内 `highway=motorway` 的高速路线，并转换为适合高德地图叠加的 GCJ-02 坐标。

## 注意

- POI 数据来自高德关键词搜索，不是权威设施名录。
- 当前过滤只处理明显异常，模糊点位保留在图上方便人工对照。
- 如高德 Key 有域名限制，需要在 `index.html` 中替换 Key 与 `securityJsCode`。

## 数据格式

`data/guizhou_expressway_pois.json` 的核心结构：

```json
{
  "items": [
    {
      "name": "某某服务区",
      "typeId": "highway_service_area",
      "location": { "lng": 106.7, "lat": 26.6 },
      "address": "",
      "district": "贵阳市"
    }
  ]
}
```

`typeId` 支持：`highway_service_area`、`service_area`、`gas_station`、`rest_area`、`toll_station`。
