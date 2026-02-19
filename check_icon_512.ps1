Add-Type -AssemblyName System.Drawing

$path = "c:\Users\memdu\Contacts\JeolojiPusulasi\icon-512.png"
try {
    $img = [System.Drawing.Image]::FromFile($path)
    Write-Host "Dimensions: $($img.Width)x$($img.Height)"
    $img.Dispose()
} catch {
    Write-Host "Error: $_"
}
