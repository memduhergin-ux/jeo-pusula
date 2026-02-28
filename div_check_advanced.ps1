
$content = Get-Content "index.html" -Raw
$balance = 0
$lineNumber = 1
$content -split "`r?`n" | ForEach-Object {
    $line = $_
    # Use regex to find all <div and </div> ignoring those in strings/comments if possible
    # but for now let's just be more precise with the counts per line
    $opens = ([regex]::Matches($line, "<div\b")).Count
    $closes = ([regex]::Matches($line, "</div>")).Count
    $balance += ($opens - $closes)
    if ($balance -lt 0) {
        Write-Host "CRITICAL: Balance negative at line $lineNumber ($balance) : $line"
        exit
    }
    $lineNumber++
}
Write-Host "Final Balance: $balance"
