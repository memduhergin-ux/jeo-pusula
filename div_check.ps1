
$content = Get-Content "index.html" -Raw
$balance = 0
$lineNumber = 1
$content -split "`r?`n" | ForEach-Object {
    $line = $_
    $opens = ([regex]::Matches($line, "<div(?!er)")).Count
    $closes = ([regex]::Matches($line, "</div>")).Count
    $balance += ($opens - $closes)
    if ($balance -lt 0) {
        Write-Host "Balance went negative at line $lineNumber : $line (Balance: $balance)"
    }
    $lineNumber++
}
Write-Host "Final Balance: $balance"
