$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("world-tree-launcher-" + [guid]::NewGuid().ToString("N"))
$stdout = Join-Path $testRoot "launcher.stdout.log"
$stderr = Join-Path $testRoot "launcher.stderr.log"
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)

try {
  New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
  $listener.Start()
  $occupiedPort = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port

  $env:PORT = [string]$occupiedPort
  $env:WORLD_TREE_DATA_DIR = Join-Path $testRoot "data"
  $env:WORLD_TREE_USER_DATA_DIR = Join-Path $testRoot "userData"
  $env:WORLD_TREE_NO_BROWSER = "1"
  $env:WORLD_TREE_LAUNCHER_PROBE_ONLY = "1"
  $env:WORLD_TREE_DISABLE_UPDATE_CHECK = "1"

  $process = Start-Process -FilePath $env:ComSpec -ArgumentList "/d", "/c", "start.bat" -WorkingDirectory $repoRoot -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  if (-not $process.WaitForExit(30000)) {
    $process.Kill($true)
    throw "launcher did not exit during probe mode"
  }
  $process.Refresh()
  $output = (Get-Content -Raw $stdout) + (Get-Content -Raw $stderr)
  if ($null -ne $process.ExitCode -and $process.ExitCode -ne 0) { throw "launcher exited $($process.ExitCode): $output" }
  if ($output -notmatch "WORLD_TREE_LAUNCHER_PROBE_URL=http://127\.0\.0\.1:(\d+)") {
    throw "launcher did not report a probe URL: $output"
  }
  if ([int]$Matches[1] -eq $occupiedPort) { throw "launcher reused an unrelated occupied port" }
  $client = [System.Net.Sockets.TcpClient]::new()
  try { $client.Connect("127.0.0.1", $occupiedPort) } finally { $client.Dispose() }
  Write-Host "Windows launcher smoke PASS: occupied=$occupiedPort selected=$($Matches[1])"
} finally {
  $listener.Stop()
  Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
}
