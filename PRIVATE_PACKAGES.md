# Private preview package

The package is published privately through GitHub Packages.

Package ID:

```text
LwXLab.Razor.Markdown
```

Repository:

```text
https://github.com/lwxlabs/LwXLab.Razor.Markdown
```

Private NuGet feed:

```text
https://nuget.pkg.github.com/lwxlabs/index.json
```

## Configure a development machine

Create a GitHub personal access token **(classic)** with `read:packages` and access to the private package, then configure a user-level NuGet source:

```powershell
$nugetConfig = Join-Path $env:APPDATA 'NuGet\NuGet.Config'
$secureToken = Read-Host 'GitHub classic PAT (read:packages)' -AsSecureString
$token = [System.Net.NetworkCredential]::new('', $secureToken).Password
try {
  dotnet nuget update source GitHub `
    --source 'https://nuget.pkg.github.com/lwxlabs/index.json' `
    --username lwxlabs `
    --password $token `
    --configfile $nugetConfig
} finally {
  $token = $null
  $secureToken.Dispose()
}
```

Install the preview package with:

```powershell
dotnet add package LwXLab.Razor.Markdown --version 1.0.0-preview.5
```

GitHub Packages does not replace an existing package version. Increase the package version before publishing an updated package.
