# install.ps1 - installs the BiliMind skill into WorkBuddy's watched user-skills folder.
#
#   powershell -ExecutionPolicy Bypass -File skills\bilimind\install.ps1
#   powershell -ExecutionPolicy Bypass -File skills\bilimind\install.ps1 -Workspace C:\Demo\DS-Final
#   powershell -ExecutionPolicy Bypass -File skills\bilimind\install.ps1 -Target C:\some\test\folder
#
# Copies SKILL.md, references\, scripts\ (the built bilimind.mjs), templates\ and assets\ to
#   %WORKBUDDY_CONFIG_DIR%\skills\bilimind   (default C:\Users\<you>\.workbuddy-ai\skills\bilimind)
# WorkBuddy watches that folder, so the skill is live without an upload. With -Workspace it also copies
# the skill to <workspace>\.codebuddy\skills\bilimind (project-level, wins on a name clash).
# Dev-only files (STATUS.md, install.ps1, scripts\zip-skill.mjs, test\, dotfiles) are not copied.
# This script never reads, writes or prints an API key. Keys live in %USERPROFILE%\.bilimind\config.json.

param(
  [string]$Target = "",
  [string]$Workspace = ""
)

$ErrorActionPreference = "Stop"
$Source = Split-Path -Parent $MyInvocation.MyCommand.Path

if ($Target -eq "") {
  $configDir = $env:WORKBUDDY_CONFIG_DIR
  if (-not $configDir) { $configDir = Join-Path $env:USERPROFILE ".workbuddy-ai" }
  $Target = Join-Path (Join-Path $configDir "skills") "bilimind"
}

$skillMd = Join-Path $Source "SKILL.md"
if (-not (Test-Path $skillMd)) { throw "SKILL.md not found next to install.ps1 ($Source)" }
$bundle = Join-Path $Source "scripts\bilimind.mjs"
if (-not (Test-Path $bundle)) {
  Write-Warning "scripts\bilimind.mjs is missing. Build it first: node apps/cli/scripts/bundle.mjs (the skill will not run without it)."
}
if (-not (Test-Path (Join-Path $Source "templates\player.html"))) {
  Write-Warning "templates\player.html is missing (the bundle step copies it). 'build' needs it."
}

function Get-SkillFiles([string]$root) {
  $devOnly = @("STATUS.md", "install.ps1", "scripts/zip-skill.mjs")
  Get-ChildItem -LiteralPath $root -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($root.Length).TrimStart('\', '/').Replace('\', '/')
    $parts = $rel.Split('/')
    $hidden = $false
    foreach ($p in $parts) { if ($p.StartsWith(".") -or $p -eq "node_modules") { $hidden = $true } }
    if (-not $hidden -and -not ($devOnly -contains $rel) -and -not $rel.StartsWith("test/") -and -not $rel.EndsWith(".map")) {
      [pscustomobject]@{ Full = $_.FullName; Rel = $rel }
    }
  }
}

function Install-To([string]$dest) {
  $resolvedSource = (Resolve-Path -LiteralPath $Source).Path.TrimEnd('\')
  if (Test-Path -LiteralPath $dest) {
    $resolvedDest = (Resolve-Path -LiteralPath $dest).Path.TrimEnd('\')
    if ($resolvedDest -eq $resolvedSource) { throw "Target is the source folder itself: $dest" }
    $old = Join-Path $dest "SKILL.md"
    $isOurs = (Test-Path -LiteralPath $old) -and ((Get-Content -LiteralPath $old -TotalCount 3) -match "^name: bilimind$")
    $isEmpty = -not (Get-ChildItem -LiteralPath $dest -Force | Select-Object -First 1)
    if (-not ($isOurs -or $isEmpty)) { throw "Refusing to replace $dest : it is not an earlier BiliMind install." }
    Remove-Item -LiteralPath $dest -Recurse -Force
  }
  $files = @(Get-SkillFiles $resolvedSource)
  foreach ($f in $files) {
    $to = Join-Path $dest ($f.Rel.Replace('/', '\'))
    $dir = Split-Path -Parent $to
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    Copy-Item -LiteralPath $f.Full -Destination $to -Force
  }
  Write-Output ("installed {0} files -> {1}" -f $files.Count, $dest)
}

Install-To $Target
if ($Workspace -ne "") {
  if (-not (Test-Path -LiteralPath $Workspace)) { throw "Workspace not found: $Workspace" }
  Install-To (Join-Path $Workspace ".codebuddy\skills\bilimind")
}

$keyFile = Join-Path $env:USERPROFILE ".bilimind\config.json"
if (Test-Path -LiteralPath $keyFile) { Write-Output "key file: present (not read)" }
else { Write-Output "key file: MISSING. Create %USERPROFILE%\.bilimind\config.json with your DeepSeek or OpenRouter key (see references\troubleshooting.md)." }
Write-Output "next: in WorkBuddy, Experts / Skills / Connectors -> Skills: 'bilimind' should be listed and on. Try: node `"$Target\scripts\bilimind.mjs`" doctor"
