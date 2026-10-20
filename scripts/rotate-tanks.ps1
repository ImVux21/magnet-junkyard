Add-Type -AssemblyName System.Drawing

$files = @(
    "public/assets/images/rover/tracks.png",
    "public/assets/images/rover/chassis_base.png",
    "public/assets/images/rover/chassis_reinforced.png",
    "public/assets/images/rover/chassis_elite.png",
    "public/assets/images/rover/magnet_emitter.png",
    "public/assets/images/hazards/rival_rover.png"
)

foreach ($f in $files) {
    $full = Resolve-Path $f
    $img = [System.Drawing.Image]::FromFile($full)
    $bmp = New-Object System.Drawing.Bitmap $img
    $img.Dispose()
    
    $bmp.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone)
    $bmp.Save($full, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Rotated: $f"
}
