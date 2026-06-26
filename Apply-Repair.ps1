param(
    [switch]$Apply,
    [string]$Root = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'
$script = Join-Path $Root 'tools\repair_content_integrity.py'
if (-not (Test-Path $script)) {
    throw "找不到修复脚本：$script。请把补丁包内容复制到仓库根目录后再运行。"
}

if ($Apply) {
    python $script --root $Root --apply
} else {
    python $script --root $Root --dry-run
}
