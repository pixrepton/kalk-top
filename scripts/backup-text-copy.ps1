# Kopiuje do backup-tekstowe/ wylacznie pliki dokumentacyjno-tekstowe:
# .md, .mdc, .txt, .markdown, .rst, .adoc oraz .pdf.
# Bez kodu zrodlowego (.ts/.js/.php itd.), bez node_modules / .git / backup-tekstowe.
$ErrorActionPreference = "Stop"
$source = Split-Path -Parent $PSScriptRoot
$destRoot = Join-Path $source "backup-tekstowe"

$excludePatterns = @("\\node_modules\\", "\\backup-tekstowe\\", "\\.git\\")

function Test-ExcludedPath([string]$fullPath) {
  foreach ($pat in $excludePatterns) {
    if ($fullPath -like "*$($pat.Trim('\'))*") { return $true }
  }
  return $false
}

# Tylko rozszerzenia z inwentaryzacji "tekstowych" + PDF
$extWhitelist = @(
  ".md", ".mdc", ".txt", ".markdown", ".rst", ".adoc",
  ".pdf"
) | ForEach-Object { $_.ToLowerInvariant() }

function Test-IsDocTextOrPdf([System.IO.FileInfo]$f) {
  $ext = $f.Extension.ToLowerInvariant()
  if ([string]::IsNullOrEmpty($ext)) { return $false }
  return ($extWhitelist -contains $ext)
}

if (-not (Test-Path -LiteralPath $destRoot)) {
  New-Item -ItemType Directory -Path $destRoot -Force | Out-Null
}

$copied = 0
Get-ChildItem -LiteralPath $source -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
  $full = $_.FullName
  if (Test-ExcludedPath $full) { return }
  if (-not (Test-IsDocTextOrPdf $_)) { return }
  $rel = $full.Substring($source.Length).TrimStart('\')
  $target = Join-Path $destRoot $rel
  $dir = Split-Path -Parent $target
  if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
  Copy-Item -LiteralPath $full -Destination $target -Force
  $script:copied++
}

Write-Host "Copied: $copied files to $destRoot"
