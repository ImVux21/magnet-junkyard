Add-Type -AssemblyName System.Drawing

$srcPath = Resolve-Path "store-assets/banner_16x9.jpg"
$destPath = "$PWD/store-assets/banner_1920x1080.jpg"

$srcImage = [System.Drawing.Image]::FromFile($srcPath)
$newWidth = 1920
$newHeight = 1080

$destBitmap = New-Object System.Drawing.Bitmap($newWidth, $newHeight)
$graphics = [System.Drawing.Graphics]::FromImage($destBitmap)

$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

$graphics.DrawImage($srcImage, 0, 0, $newWidth, $newHeight)

# Save with 95% JPEG quality
$encoder = [System.Drawing.Imaging.Encoder]::Quality
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter($encoder, [long]95)

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }

$destBitmap.Save($destPath, $jpegCodec, $encoderParams)

$graphics.Dispose()
$destBitmap.Dispose()
$srcImage.Dispose()

# Overwrite original banner_16x9.jpg with the 1920x1080 version
Move-Item -Force $destPath $srcPath
Write-Host "Banner successfully resized to 1920x1080."
