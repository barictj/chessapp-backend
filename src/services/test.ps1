# test-moves.ps1
# Configure these for your environment
$base = "http://localhost:3000/api/games"   # base games endpoint
$whiteToken = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYmFyaWN0akBnbWFpbC5jb20iLCJuYW1lIjoiVGhvbWFzIEJhcmljIiwiaWF0IjoxNzY3OTkyOTY4LCJleHAiOjE3Njg1OTc3Njh9.nzQ3pH7mVGS7NGc4uQzj8A8DHsoZ29ZQpPA8jUPp4gs"
$blackToken = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsImVtYWlsIjoiZG90cmVkdWNlQGdtYWlsLmNvbSIsIm5hbWUiOiJUaG9tYXMgQmFyaWMiLCJpYXQiOjE3Njc5OTM4OTMsImV4cCI6MTc2ODU5ODY5M30.HOJUx3GYVKPvaT04vw-CDXurqYsIl4t1BMXyUdwF1Lc"
$gameId = 35                               # change to the game id you want to test

# helper to POST a move
function Post-Move($gameId, $token, $from, $to, $promotion, $requestId) {
    $url = "$base/$gameId/move"
    $body = @{
        from = $from
        to = $to
        promotion = $promotion
        request_id = $requestId
    } | ConvertTo-Json
    try {
        $resp = Invoke-RestMethod -Method POST -Uri $url -Headers @{ Authorization = $token } -Body $body -ContentType "application/json" -ErrorAction Stop
        return @{ success = $true; status = 200; body = $resp }
    } catch {
        $we = $_.Exception.Response
        if ($we) {
            $sr = New-Object System.IO.StreamReader($we.GetResponseStream())
            $text = $sr.ReadToEnd()
            return @{ success = $false; status = $we.StatusCode.Value__; body = $text }
        } else {
            return @{ success = $false; status = 0; body = $_.Exception.Message }
        }
    }
}

# helper to GET game and moves
function Get-Game($gameId, $token) {
    $gameUrl = "$base/$gameId"
    $movesUrl = "$base/$gameId/moves"
    $g = Invoke-RestMethod -Method GET -Uri $gameUrl -Headers @{ Authorization = $token }
    $m = Invoke-RestMethod -Method GET -Uri $movesUrl -Headers @{ Authorization = $token }
    return @{ game = $g; moves = $m }
}

Write-Host "=== Single legal move (White) ==="
# Example: white moves pawn from b7 to a8 promoting to queen (adjust to a legal move for your game)
$req1 = "test-p1-$(Get-Random)"
$single = Post-Move -gameId $gameId -token $whiteToken -from "b7" -to "a8" -promotion "q" -requestId $req1
Write-Host "RequestId:" $req1
Write-Host "Response:" ($single.body | ConvertTo-Json -Depth 5)

Start-Sleep -Seconds 1

Write-Host "`n=== Idempotent retry (same request_id) ==="
$retry = Post-Move -gameId $gameId -token $whiteToken -from "b7" -to "a8" -promotion "q" -requestId $req1
Write-Host "Retry Response:" ($retry.body | ConvertTo-Json -Depth 5)

Start-Sleep -Seconds 1

Write-Host "`n=== Concurrent race test (Black) ==="
# Two different black moves that could race; adjust squares to legal moves for your position
$reqA = "race-A-$(Get-Random)"
$reqB = "race-B-$(Get-Random)"

# Start two jobs to run in parallel
$jobA = Start-Job -ScriptBlock {
    param($base,$gameId,$token,$from,$to,$promotion,$requestId)
    $url = "$base/$gameId/move"
    $body = @{ from=$from; to=$to; promotion=$promotion; request_id=$requestId } | ConvertTo-Json
    try {
        $r = Invoke-RestMethod -Method POST -Uri $url -Headers @{ Authorization = $token } -Body $body -ContentType "application/json"
        return @{ ok = $true; req = $requestId; resp = $r }
    } catch {
        return @{ ok = $false; req = $requestId; err = $_.Exception.Message }
    }
} -ArgumentList $base,$gameId,$blackToken,"b2","a1","q",$reqA

$jobB = Start-Job -ScriptBlock {
    param($base,$gameId,$token,$from,$to,$promotion,$requestId)
    $url = "$base/$gameId/move"
    $body = @{ from=$from; to=$to; promotion=$promotion; request_id=$requestId } | ConvertTo-Json
    try {
        $r = Invoke-RestMethod -Method POST -Uri $url -Headers @{ Authorization = $token } -Body $body -ContentType "application/json"
        return @{ ok = $true; req = $requestId; resp = $r }
    } catch {
        return @{ ok = $false; req = $requestId; err = $_.Exception.Message }
    }
} -ArgumentList $base,$gameId,$blackToken,"b2","a1","q",$reqB

# wait for both to finish
Wait-Job -Job $jobA,$jobB -Timeout 10 | Out-Null
$resA = Receive-Job -Job $jobA
$resB = Receive-Job -Job $jobB
Remove-Job -Job $jobA,$jobB

Write-Host "Race result A:" ($resA | ConvertTo-Json -Depth 5)
Write-Host "Race result B:" ($resB | ConvertTo-Json -Depth 5)

Start-Sleep -Seconds 1

Write-Host "`n=== Final game state and moves ==="
$final = Get-Game -gameId $gameId -token $whiteToken
Write-Host "Game:" ($final.game | ConvertTo-Json -Depth 5)
Write-Host "Moves:" ($final.moves | ConvertTo-Json -Depth 10)

Write-Host "`n=== Quick consistency checks ==="
# Check last_move_id presence and that last move fen matches game.fen
try {
    $gameFen = $final.game.fen
    $lastMoveId = $final.game.last_move_id
    if ($null -eq $lastMoveId) {
        Write-Host "WARNING: games.last_move_id is NULL"
    } else {
        $lastMove = ($final.moves | Where-Object { $_.id -eq $lastMoveId })
        if ($null -eq $lastMove) {
            Write-Host "WARNING: last_move_id does not match any move in moves list"
        } else {
            Write-Host "Last move id:" $lastMoveId "san:" $lastMove.san "fen_after:" $lastMove.fen_after
            if ($lastMove.fen_after -ne $gameFen) {
                Write-Host "WARNING: fen mismatch between games.fen and last move fen_after"
            } else {
                Write-Host "OK: games.fen matches last move fen_after"
            }
        }
    }
} catch {
    Write-Host "Consistency check failed:" $_.Exception.Message
}

Write-Host "`nTest script complete."
