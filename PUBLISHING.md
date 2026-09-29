# Publishing

## Validate and pack locally

Run:

```powershell
.\build\pack.ps1
```

The script restores, builds and packs the Razor component for `net8.0`, `net9.0` and `net10.0`.

Expected output:

```text
artifacts/release/LwXLab.Razor.Markdown.1.0.0-preview.5.nupkg
```

Do not publish if restore, build, or pack fails.

## Publish to private GitHub Packages

Publishing is intentionally manual. In GitHub Actions, run the `publish-private-packages` workflow.

It publishes the package to:

```text
https://nuget.pkg.github.com/lwxlabs/index.json
```

After publishing, run the `verify-private-feed` workflow. It restores `LwXLab.Razor.Markdown` into a clean .NET 10 Blazor application and builds the consumer.

Never commit GitHub tokens, NuGet credentials, generated package artifacts, IDE state, build output, or AI workspace/cache files.
