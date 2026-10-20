$baseDir = "c:\Users\vuodo\software\magnet-junkyard"
$downloads = Join-Path $baseDir "downloads"
$extracted = Join-Path $downloads "extracted"

if (!(Test-Path $extracted)) {
    New-Item -ItemType Directory -Path $extracted -Force | Out-Null
}

$zipMap = @{
    "tanks" = "top-down-tanks.zip"
    "particles" = "particle-pack.zip"
    "items" = "generic-items.zip"
    "ui" = "ui-pack.zip"
    "impact" = "impact-sounds.zip"
    "interface" = "interface-sounds.zip"
    "scifi" = "sci-fi-sounds.zip"
}

foreach ($key in $zipMap.Keys) {
    $zipFile = Join-Path $downloads $zipMap[$key]
    $targetDir = Join-Path $extracted $key
    if (Test-Path $zipFile) {
        if (!(Test-Path $targetDir)) {
            Write-Output "Extracting $key..."
            Expand-Archive -Path $zipFile -DestinationPath $targetDir -Force
            Write-Output "Extracted $key successfully."
        } else {
            Write-Output "$key already extracted."
        }
    }
}
