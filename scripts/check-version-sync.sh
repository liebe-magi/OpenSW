#!/bin/bash
# Check that version is synced across package.json, Cargo.toml, and tauri.conf.json

set -e

PKG_VER=$(grep '"version"' package.json | head -1 | sed 's/.*: "\(.*\)".*/\1/')
CARGO_VER=$(grep '^version' src-tauri/Cargo.toml | head -1 | sed 's/.*= "\(.*\)".*/\1/')
TAURI_VER=$(grep '"version"' src-tauri/tauri.conf.json | head -1 | sed 's/.*: "\(.*\)".*/\1/')

echo "package.json:      $PKG_VER"
echo "Cargo.toml:        $CARGO_VER"
echo "tauri.conf.json:   $TAURI_VER"

if [ "$PKG_VER" != "$CARGO_VER" ] || [ "$PKG_VER" != "$TAURI_VER" ]; then
  echo ""
  echo "❌ Version mismatch detected!"
  exit 1
fi

echo ""
echo "✅ All versions synced: $PKG_VER"
