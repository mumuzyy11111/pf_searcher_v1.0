param(
    [switch]$Apply,
    [string]$Root = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'
$utf8 = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8

try {
    chcp 65001 | Out-Null
} catch {
    # Some non-interactive shells do not expose chcp; UTF-8 .NET encodings above are enough.
}

$script = Join-Path $Root 'tools\repair_content_integrity.py'
if (-not (Test-Path $script)) {
    throw "找不到修复脚本：$script。请把补丁包内容复制到仓库根目录后再运行。"
}

if ($Apply) {
    python $script --root $Root --apply
} else {
    python $script --root $Root --dry-run
}
