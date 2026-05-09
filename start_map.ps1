$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$port = 8010
$root = $PSScriptRoot
$url = "http://localhost:$port/index.html"

Write-Host "贵州高速服务设施 POI 地图" -ForegroundColor Cyan
Write-Host "目录: $root" -ForegroundColor Gray
Write-Host "地址: $url" -ForegroundColor Yellow

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
  Write-Host "未找到 Python，请手动用任意静态 HTTP 服务打开本目录。" -ForegroundColor Red
  Read-Host "按 Enter 退出"
  exit 1
}

Start-Process $url
Set-Location $root
python -m http.server $port
