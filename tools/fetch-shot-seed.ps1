$ErrorActionPreference = 'Stop'
$games = @{}
foreach ($gameCode in 1..80) {
  $response = Invoke-RestMethod "https://live.euroleague.net/api/Points?gamecode=$gameCode&seasoncode=E2026"
  if (!$response.Rows) { throw "No shots: $gameCode" }
  $games["$gameCode"] = @($response.Rows | ForEach-Object { ,@($_.TEAM.Trim(), $_.ID_PLAYER.Trim().TrimStart('P'), $_.ID_ACTION, [double]$_.COORD_X, [double]$_.COORD_Y, [int]$_.POINTS, [int]$_.FASTBREAK, [int]$_.SECOND_CHANCE) })
  if ($gameCode % 10 -eq 0) { Write-Output "Downloaded $gameCode / 80" }
  Start-Sleep -Milliseconds 150
}
$json = ConvertTo-Json -InputObject $games -Depth 6 -Compress
[IO.File]::WriteAllText((Join-Path $PWD 'site/fantasy-shots-seed.js'), "/* EuroLeague Points E2026 games 1-80; fetched 2026-10-31. Validated against box scores at runtime. */`nglobalThis.FANTASY_SHOTS_SEED=$json;", [Text.UTF8Encoding]::new($false))
