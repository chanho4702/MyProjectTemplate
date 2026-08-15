param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z][a-z0-9-]{2,39}$')]
    [string]$Name,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$')]
    [string]$BasePackage,

    [string]$ConfigPath
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$templateRoot = Join-Path $repoRoot 'templates\service-template'
$servicesRoot = Join-Path $repoRoot 'services'
$destination = Join-Path $servicesRoot $Name

if (-not (Test-Path -LiteralPath $templateRoot)) {
    throw "Service template was not found: $templateRoot"
}
if (Test-Path -LiteralPath $destination) {
    throw "Service already exists: $destination"
}
if (-not $destination.StartsWith($servicesRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Resolved service path is outside the services directory.'
}

$className = (($Name -split '-') | ForEach-Object {
    $_.Substring(0, 1).ToUpperInvariant() + $_.Substring(1)
}) -join ''
$packagePath = $BasePackage -replace '\.', '\'

$resolvedConfig = $null
if ($ConfigPath) {
    $resolvedConfig = (Resolve-Path -LiteralPath $ConfigPath).Path
} elseif (Test-Path -LiteralPath (Join-Path $repoRoot 'template-config.json')) {
    $resolvedConfig = Join-Path $repoRoot 'template-config.json'
}

$optionalStarters = @()
if ($resolvedConfig) {
    $selection = Get-Content -Raw -LiteralPath $resolvedConfig | ConvertFrom-Json
    if ($selection.features.redis) {
        $optionalStarters += "implementation project(':starters:platform-starter-redis')"
    }
    if ($selection.features.kafka) {
        $optionalStarters += "implementation project(':starters:platform-starter-kafka')"
    }
    if ($selection.features.elasticsearch) {
        $optionalStarters += "implementation project(':starters:platform-starter-search')"
    }
}
$optionalStarterBlock = if ($optionalStarters.Count -gt 0) {
    $optionalStarters -join "`r`n    "
} else {
    '// No optional platform starters selected.'
}

Copy-Item -LiteralPath $templateRoot -Destination $destination -Recurse

foreach ($sourceSet in @('main', 'test')) {
    $javaRoot = Join-Path $destination "src\$sourceSet\java"
    $tokenDirectory = Join-Path $javaRoot '__PACKAGE_PATH__'
    $packageDirectory = Join-Path $javaRoot $packagePath
    $packageParent = Split-Path -Parent $packageDirectory
    New-Item -ItemType Directory -Force -Path $packageParent | Out-Null
    Move-Item -LiteralPath $tokenDirectory -Destination $packageDirectory
}

$utf8 = [System.Text.UTF8Encoding]::new($false)
Get-ChildItem -LiteralPath $destination -File -Recurse | ForEach-Object {
    $content = [System.IO.File]::ReadAllText($_.FullName)
    $content = $content.Replace('__SERVICE_NAME__', $Name)
    $content = $content.Replace('__BASE_PACKAGE__', $BasePackage)
    $content = $content.Replace('__CLASS_NAME__', $className)
    $content = $content.Replace('// __OPTIONAL_STARTERS__', $optionalStarterBlock)
    [System.IO.File]::WriteAllText($_.FullName, $content, $utf8)

    if ($_.Name.Contains('__CLASS_NAME__')) {
        $newName = $_.Name.Replace('__CLASS_NAME__', $className)
        Rename-Item -LiteralPath $_.FullName -NewName $newName
    }
}

Write-Output "Created services/$Name"
if ($resolvedConfig) {
    Write-Output "Applied optional starters from $resolvedConfig"
}
Write-Output "Run: ./gradlew :services:${Name}:test"
