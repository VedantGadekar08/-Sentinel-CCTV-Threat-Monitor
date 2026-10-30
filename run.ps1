$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot

$jdkCandidates = @()
if ($env:JAVA_HOME) {
    $jdkCandidates += $env:JAVA_HOME
}
$jdkCandidates += Get-ChildItem "C:\Program Files\Java" -Directory -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -ExpandProperty FullName

$jdk = $null
foreach ($candidate in ($jdkCandidates | Select-Object -Unique)) {
    $java = Join-Path $candidate "bin\java.exe"
    if (-not (Test-Path $java)) {
        continue
    }

    $versionOutput = (& $java -version 2>&1 | Out-String)
    if ($versionOutput -match 'version "(\d+)') {
        $majorVersion = [int]$Matches[1]
        if ($majorVersion -ge 25) {
            $jdk = $candidate
            break
        }
    }
}

if (-not $jdk) {
    Write-Host "No JDK 25 or newer was found. Install JDK 25 or newer, then run start.bat again." -ForegroundColor Red
    exit 1
}

$env:JAVA_HOME = $jdk
$env:Path = "$(Join-Path $jdk 'bin');$env:Path"
Write-Host "Using Java at $jdk"

$mavenWrapper = Join-Path $projectRoot "mvnw.cmd"
if (-not (Test-Path $mavenWrapper)) {
    Write-Host "The Maven Wrapper is missing. Run this launcher from the project folder or restore mvnw.cmd." -ForegroundColor Red
    exit 1
}

try {
    $listener = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($listener) {
        $owner = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
        $ownerName = if ($owner) { $owner.ProcessName } else { "another application" }
        Write-Host "Port 8000 is already used by $ownerName (PID $($listener.OwningProcess)). Stop it with Ctrl+C in its terminal, or close that process, then retry." -ForegroundColor Yellow
        exit 1
    }
} catch {
    # Continue startup if Windows does not provide the port-inspection cmdlet.
}

Set-Location $projectRoot
Write-Host "Starting Sentinel at http://127.0.0.1:8000"
& $mavenWrapper spring-boot:run
exit $LASTEXITCODE
