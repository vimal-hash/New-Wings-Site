param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$authoringRoot = 'D:\CodexOutputs\Theatre_Ceiling_PBR_20261023'
if ($projectRoot -ne 'D:\New folio\new site code\new_site_three') { throw 'Unexpected project root' }
$targets = [Collections.Generic.List[string]]::new()
function Add-CleanupFile([string]$path) {
  $absolute = [IO.Path]::GetFullPath($path)
  if (-not ($absolute.StartsWith($projectRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or $absolute.StartsWith($authoringRoot+'\',[StringComparison]::OrdinalIgnoreCase))) { throw "Outside cleanup roots: $absolute" }
  if (Test-Path -LiteralPath $absolute -PathType Leaf) { $targets.Add($absolute) }
}
$manifest = Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'components/corridor/theatre-ceiling-assets.json') | ConvertFrom-Json
# This one-time cleanup predates the separate desktop and mobile ceiling textures.
if (@($manifest.textures.PSObject.Properties.Name) -notcontains 'ceiling-surface-edges.ktx2') {
  Write-Output 'Historical cleanup skipped. The current theatre uses a different ceiling asset set.'
  return
}
$ceilingFolder = Join-Path $projectRoot 'public/textures/theatre/ceiling'
$acceptedTextures = @($manifest.textures.PSObject.Properties.Name)
Get-ChildItem -LiteralPath $ceilingFolder -File | Where-Object Name -NotIn $acceptedTextures | ForEach-Object { Add-CleanupFile $_.FullName }
Get-ChildItem -LiteralPath (Join-Path $projectRoot 'public/models/theatre') -File | Where-Object Name -NE 'ceiling-uv-fixed.glb' | ForEach-Object { Add-CleanupFile $_.FullName }
$emptyTrees = @('public/textures/theatre-floor','public/textures/theatre-floor-quality','docs/theatre-ceiling-audit/pass-two-backup','docs/theatre-ceiling-audit/pre-crisp','docs/theatre-ceiling-audit/pre-final')
foreach ($relative in $emptyTrees) {
  $folder = Join-Path $projectRoot $relative
  if (Test-Path -LiteralPath $folder) { Get-ChildItem -LiteralPath $folder -File -Recurse | ForEach-Object { Add-CleanupFile $_.FullName } }
}
$obsolete = @(
 'public/models/theatre-floor.glb','public/models/theatre-floor-detail.glb',
 'components/corridor/theatre-floor.tsx','components/corridor/theatre-floor-assets.json','components/corridor/theatre-floor-geometry.ts','components/corridor/theatre-floor-ids.json','components/corridor/theatre-floor-opening.json','components/corridor/theatre-floor-radiance.ts','components/corridor/floor-radiance-loader.ts',
 'scripts/encode-ceiling-combined.mjs','scripts/export-ceiling-native-test.mjs','scripts/audit-ceiling-normals.mjs','scripts/verify-ceiling-third.mjs','scripts/measure-ceiling-cleanup.mjs','scripts/fix-ceiling-reference-normals.mjs','scripts/compare-ceiling-reference.mjs','scripts/blender/locate-ceiling-uv-distortion.py',
 'scripts/compare-floor-quality.mjs','scripts/compare-floor-reference.mjs','scripts/encode-floor-quality.mjs','scripts/encode-theatre-floor.mjs','scripts/verify-floor-radiance.mjs','scripts/verify-theatre-floor.mjs','scripts/inspect-floor-ids.mjs',
 'scripts/blender/bake-cove-native-test.py','scripts/blender/test-ceiling-light-field.py','scripts/blender/resize-ceiling-combined.py','scripts/blender/rebake-ceiling-combined.py','scripts/blender/denoise-ceiling-combined.py',
 'scripts/blender/bake-floor-quality-base.py','scripts/blender/bake-theatre-floor.py','scripts/blender/check-directional-coverage.py','scripts/blender/check-floor-bakes.py','scripts/blender/check-floor-display.py','scripts/blender/denoise-floor-quality-base.py','scripts/blender/export-floor-native-detail.py','scripts/blender/export-floor-opening-detail.py','scripts/blender/finalize-floor-copy.py','scripts/blender/measure-floor-directions.py','scripts/blender/measure-floor-opening.py','scripts/blender/pack-floor-directions.py','scripts/blender/polish-theatre-floor-bakes.py','scripts/blender/render-floor-quality-reference.py','scripts/blender/repack-floor-visible-uv.py'
)
foreach ($relative in $obsolete) { Add-CleanupFile (Join-Path $projectRoot $relative) }
$keepImages = @('ceiling-edges-before.png','ceiling-edges-fixed.png','ceiling-direct-opening.png','ceiling-direct-tilted.png','ceiling-direct-mobile.png','blender-wide-matched.png','blender-ceiling-extended.png','ceiling-band-before.png','ceiling-band-fixed.png','ceiling-band-fixed-steep.png','ceiling-band-fixed-mobile.png','ceiling-uv-fixed-final.png','ceiling-uv-fixed-pullback.png','ceiling-wide-fixed.png','ceiling-single-orbit.png','ceiling-single-final.png','ceiling-single-travel.png','ceiling-single-mobile.png')
Get-ChildItem -LiteralPath (Join-Path $projectRoot 'docs/theatre-ceiling-audit') -File | Where-Object { $_.Extension -in @('.log','.ktx2','.glb','.tsx','.txt') -or ($_.Extension -eq '.png' -and $_.Name -notin $keepImages) } | ForEach-Object { Add-CleanupFile $_.FullName }
Get-ChildItem -LiteralPath (Join-Path $projectRoot 'docs/theatre-floor-audit') -File | Where-Object { $_.Extension -in @('.log','.txt') -or ($_.Extension -eq '.png' -and $_.Name -ne 'quality-opening-1920.png') } | ForEach-Object { Add-CleanupFile $_.FullName }
$keepMasters = @('ceiling-edge-source.exr','ceiling-edge-stitched.exr','ceiling-edge-stitched-clean.exr','ceiling-edge-stitched-clean.png','ceiling-direct-surface.exr','ceiling-direct-surface.png','ceiling-direct-surface-clean.exr','ceiling-direct-surface-clean.png','Ceiling_PBR_prepared.blend','Ceiling_PBR_baked.blend','ceiling.glb','irradiance.exr','specular.exr','normal.png','normal-clean.png','irradiance-final.exr','specular-final.exr','irradiance-uv-fixed.exr','specular-uv-fixed.exr','normal-uv-fixed.png','environment.exr','display-lut.png','approved-ceiling-atlas-complete.png')
Get-ChildItem -LiteralPath $authoringRoot -File | Where-Object { $_.Name -notin $keepMasters -and $_.Extension -in @('.blend1','.exr','.png') } | ForEach-Object { Add-CleanupFile $_.FullName }
$plan = @($targets | Sort-Object -Unique | ForEach-Object { $file = Get-Item -LiteralPath $_; [pscustomobject]@{path=$file.FullName;bytes=$file.Length} })
$reportPath = Join-Path $projectRoot 'docs/theatre-ceiling-audit/cleanup-report.json'
$previous = @()
if (Test-Path -LiteralPath $reportPath) {
  $priorReport = Get-Content -Raw -LiteralPath $reportPath | ConvertFrom-Json
  if ($priorReport.status -eq 'deleted') { $previous = @($priorReport.files) }
}
$allEntries = @(@($previous) + @($plan) | Sort-Object path -Unique)
$total = ($allEntries | Measure-Object bytes -Sum).Sum
$report = [ordered]@{status='planned';fileCount=$allEntries.Count;bytes=$total;files=$allEntries;runtimeCeilingBytes=$manifest.bytes;protectedOriginalModels=20;originalBlendFilesUntouched=$true}
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $reportPath
if ($Apply) {
  # Delete verified individual files, never recursively remove a computed path.
  foreach ($file in $plan) { Remove-Item -LiteralPath $file.path -Force }
  foreach ($relative in $emptyTrees) {
    $folder = [IO.Path]::GetFullPath((Join-Path $projectRoot $relative))
    if (-not $folder.StartsWith($projectRoot+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe empty directory path' }
    if (Test-Path -LiteralPath $folder) {
      Get-ChildItem -LiteralPath $folder -Directory -Recurse | Sort-Object FullName -Descending | ForEach-Object { if (@(Get-ChildItem -LiteralPath $_.FullName -Force).Count -eq 0) { Remove-Item -LiteralPath $_.FullName } }
      if (@(Get-ChildItem -LiteralPath $folder -Force).Count -eq 0) { Remove-Item -LiteralPath $folder }
    }
  }
  $report.status='deleted';$report.remainingDeletedFiles=@($allEntries | Where-Object { Test-Path -LiteralPath $_.path }).Count
  $report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $reportPath
}
[pscustomobject]@{Status=$report.status;Files=$allEntries.Count;FreedMB=[math]::Round($total/1000000,2);CeilingMB=[math]::Round($manifest.bytes/1000000,2)} | Format-List
