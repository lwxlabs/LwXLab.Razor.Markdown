#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/artifacts/release"
mkdir -p "$OUT"
cd "$ROOT"

dotnet restore LwXLab.Markdown.csproj
dotnet build LwXLab.Markdown.csproj -c Release --no-restore
dotnet pack LwXLab.Markdown.csproj -c Release --no-build --no-restore --output "$OUT"

echo "Package: $OUT"
