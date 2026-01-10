# ci-full-game-with-token-gen.ps1
# Replace the placeholder with your real JWT secret before running
$env:REAL_JWT_SECRET = 'dev-jwt-secret-change-me'   # <-- set this to your server JWT secret

if (-not $env:REAL_JWT_SECRET -or $env:REAL_JWT_SECRET -eq 'YOUR_REAL_JWT_SECRET') {
  Write-Error "Set \$env:REAL_JWT_SECRET to your real JWT secret in this shell before running the script."
  exit 1
}

# --- Generate tokens for both players and export them into env vars ---
# Player A (sub = 3)
# Player A (sub = 3)
$env:PLAYER_A = node -e "const jwt=require('jsonwebtoken'); console.log(jwt.sign({ sub:'3', email:'ci_test_google@example.com', provider:'google' }, process.env.REAL_JWT_SECRET, { algorithm:'HS256', expiresIn:'7d' }));"

# Player B (sub = 7)
$env:PLAYER_B = node -e "const jwt=require('jsonwebtoken'); console.log(jwt.sign({ sub:'7', email:'ci_test_google_b@example.com', provider:'google' }, process.env.REAL_JWT_SECRET, { algorithm:'HS256', expiresIn:'7d' }));"

Write-Output "Generated PLAYER_A token (first 8 chars): $($env:PLAYER_A.Substring(0,8))..."
Write-Output "Generated PLAYER_B token (first 8 chars): $($env:PLAYER_B.Substring(0,8))..."

# --- Settings for the full game run ---
$playerAId   = 3    # creator id (for logging only)
$playerBId   = 7    # opponent_id to pass to create endpoint
$baseUrl     = 'http://localhost:3000'
$moveDelayMs = 300

# Predetermined move sequence (Scholar's Mate)
$fullMoves = @(
  @{ from='e2'; to='e4' },   # 1. e4
  @{ from='e7'; to='e5' },   # 1... e5
  @{ from='d1'; to='h5' },   # 2. Qh5
  @{ from='b8'; to='c6' },   # 2... Nc6
  @{ from='f1'; to='c4' },   # 3. Bc4
  @{ from='g8'; to='f6' },   # 3... Nf6
  @{ from='h5'; to='f7' }    # 4. Qxf7# (checkmate)
)

function New-RequestId {
  return [guid]::NewGuid().ToString().Substring(0,8)
}

function Read-ResponseBody($response) {
  try {
    $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
    return $reader.ReadToEnd()
  } catch {
    return $null
  }
}

function Create-Game($token, $opponentId) {
  $body = @{ opponent_id = $opponentId } | ConvertTo-Json
  try {
    $resp = Invoke-RestMethod -Uri "$baseUrl/api/games" -Method Post -Headers @{ Authorization = "Bearer $token" } -Body $body -ContentType 'application/json' -ErrorAction Stop
    Write-Output "Created game id: $($resp.id)"
    return $resp
  } catch {
    if ($_.Exception.Response -ne $null) {
      $status = $_.Exception.Response.StatusCode.value__ 2>$null
      $text = Read-ResponseBody $_.Exception.Response
      Write-Error "Create-Game failed: HTTP $status`n$text"
    } else {
      Write-Error "Create-Game failed: $($_.Exception.Message)"
    }
    return $null
  }
}

function Post-Move($token, $gameId, $from, $to, $requestId) {
  $body = @{ from = $from; to = $to; request_id = $requestId } | ConvertTo-Json
  try {
    $resp = Invoke-RestMethod -Uri "$baseUrl/api/games/$gameId/move" -Method Post -Headers @{ Authorization = "Bearer $token" } -Body $body -ContentType 'application/json' -ErrorAction Stop
    return $resp
  } catch {
    if ($_.Exception.Response -ne $null) {
      $status = $_.Exception.Response.StatusCode.value__ 2>$null
      $text = Read-ResponseBody $_.Exception.Response
      Write-Error "Move POST failed: HTTP $status`n$text"
    } else {
      Write-Error "Move POST failed: $($_.Exception.Message)"
    }
    return $null
  }
}

function Get-Game($token, $gameId) {
  try {
    return Invoke-RestMethod -Uri "$baseUrl/api/games/$gameId" -Method Get -Headers @{ Authorization = "Bearer $token" } -ErrorAction Stop
  } catch {
    Write-Warning "Get-Game failed: $($_.Exception.Message)"
    return $null
  }
}

# --- Run one full predetermined game ---
Write-Output "Starting full game run (Scholar's Mate sequence)..."

$createResp = Create-Game $env:PLAYER_A $playerBId
if (-not $createResp) { Write-Error "Game creation failed; aborting."; exit 1 }
$gameId = $createResp.id

$turn = 0
foreach ($m in $fullMoves) {
  $token = if ($turn % 2 -eq 0) { $env:PLAYER_A } else { $env:PLAYER_B }
  $rid = New-RequestId
  Write-Output "Posting move #$($turn+1): $($m.from)->$($m.to) (request_id=$rid)"
  $moveResp = Post-Move $token $gameId $m.from $m.to $rid
  if ($moveResp -eq $null) {
    Write-Error "Move failed; aborting game."
    break
  }
  if ($moveResp.move -ne $null) {
    Write-Output " -> Move accepted: $($moveResp.move.san) ; game turn: $($moveResp.turn) ; status: $($moveResp.status)"
  } else {
    Write-Output " -> Response: $($moveResp | ConvertTo-Json -Depth 3)"
  }

  if ($moveResp.status -and $moveResp.status -ne 'active') {
    Write-Output "Game status is '$($moveResp.status)'. Stopping move loop."
    break
  }

  Start-Sleep -Milliseconds $moveDelayMs
  $turn++
}

# fetch final state
$final = Get-Game $env:PLAYER_A $gameId
if ($final) {
  Write-Output "Final game: id=$($final.id) status=$($final.status) turn=$($final.turn) last_move_id=$($final.last_move_id)"
  Write-Output "Final FEN: $($final.fen)"
  Write-Output "Final PGN:`n$($final.pgn)"
} else {
  Write-Warning "Could not fetch final game state."
}

Write-Output "Full game run complete."
