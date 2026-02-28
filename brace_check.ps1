
$content = Get-Content "c:\Users\memdu\Contacts\JeolojiPusulasi\app.js" -Raw
$openCount = 0
$closeCount = 0
$lineNumber = 1
$content -split "`r?`n" | ForEach-Object {
    $line = $_
    $opens = ([regex]::Matches($line, "{")).Count
    $closes = ([regex]::Matches($line, "}")).Count
    $openCount += $opens
    $closeCount += $closes
    if ($closeCount > $openCount) {
        Write-Host "Extra closing brace at line $lineNumber : $line"
        # Reset counts for the next block to find more errors if any, 
        # but realistically the first one is the most important.
    }
    $lineNumber++
}
Write-Host "Total Opens: $openCount, Total Closes: $closeCount"
