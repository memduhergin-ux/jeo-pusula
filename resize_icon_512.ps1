Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path (Get-Location) "icon-512.png"
# We are overwriting the file with the resized version
$tempPath = Join-Path (Get-Location) "icon-512-temp.png"

Write-Host "Resizing $sourcePath to 512x512"

try {
    $img = [System.Drawing.Image]::FromFile($sourcePath)
    $bitmap = New-Object System.Drawing.Bitmap(512, 512)
    $graph = [System.Drawing.Graphics]::FromImage($bitmap)
    
    # High quality resizing settings
    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graph.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $graph.Clear([System.Drawing.Color]::Transparent)
    $graph.DrawImage($img, 0, 0, 512, 512)
    
    $bitmap.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $img.Dispose()
    $bitmap.Dispose()
    $graph.Dispose()
    
    # Replace original file
    Move-Item -Path $tempPath -Destination $sourcePath -Force
    
    Write-Host "SUCCESS: Icon resized to 512x512"
} catch {
    Write-Host "ERROR: $_"
    exit 1
}
