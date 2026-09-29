$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "artifacts\release"
New-Item -ItemType Directory -Force -Path $out | Out-Null

function Invoke-DotNet([Parameter(ValueFromRemainingArguments = $true)][string[]] $Arguments) {
    & dotnet @Arguments
    if ($LASTEXITCODE -ne 0) { throw "dotnet $($Arguments -join ' ') failed with exit code $LASTEXITCODE." }
}

Push-Location $root
try {
    Invoke-DotNet restore "LwXLab.Markdown.csproj"
    Invoke-DotNet build "LwXLab.Markdown.csproj" -c Release --no-restore
    Invoke-DotNet pack "LwXLab.Markdown.csproj" -c Release --no-build --no-restore --output $out
}
finally {
    Pop-Location
}

Write-Host "Package: $out"
