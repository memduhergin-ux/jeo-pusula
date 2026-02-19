Add-Type -AssemblyName System.Drawing

$iconPath = Join-Path (Get-Location) "icon-512.png"
$narrowPath = Join-Path (Get-Location) "screenshot_narrow.png"
$widePath = Join-Path (Get-Location) "screenshot_wide.png"

# Colors from manifest
$bgColor = [System.Drawing.ColorTranslator]::FromHtml("#121212")

# Function to create screenshot
function Create-Screenshot {
    param (
        [string]$outputPath,
        [int]$width,
        [int]$height,
        [string]$iconSource
    )

    $bitmap = New-Object System.Drawing.Bitmap($width, $height)
    $graph = [System.Drawing.Graphics]::FromImage($bitmap)
    $graph.Clear($bgColor)

    if (Test-Path $iconSource) {
        $img = [System.Drawing.Image]::FromFile($iconSource)
        # Draw icon in center
        $iconW = $img.Width
        $iconH = $img.Height
        
        # Calculate center
        $x = [int](($width - $iconW) / 2)
        $y = [int](($height - $iconH) / 2)
        
        $graph.DrawImage($img, $x, $y, $iconW, $iconH)
        $img.Dispose()
    } else {
        Write-Host "Warning: Icon not found at $iconSource. Creating blank background."
    }

    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graph.Dispose()
    $bitmap.Dispose()
    Write-Host "Created $outputPath"
}

Create-Screenshot -outputPath $narrowPath -width 1080 -height 1920 -iconSource $iconPath
Create-Screenshot -outputPath $widePath -width 1920 -height 1080 -iconSource $iconPath
