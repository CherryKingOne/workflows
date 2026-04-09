#!/bin/bash

# Check Build Artifacts Script
# Verifies that all expected build artifacts are present

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Checking build artifacts..."

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
echo "Version: $VERSION"

# macOS artifacts
echo -e "\n${YELLOW}macOS Artifacts:${NC}"
if [ -d "src-tauri/target/release/bundle/dmg" ]; then
  DMG_X64=$(find src-tauri/target/release/bundle/dmg -name "*x64.dmg" 2>/dev/null | head -1)
  DMG_AARCH64=$(find src-tauri/target/release/bundle/dmg -name "*aarch64.dmg" 2>/dev/null | head -1)

  if [ -n "$DMG_X64" ]; then
    SIZE=$(du -h "$DMG_X64" | cut -f1)
    echo -e "${GREEN}✓${NC} Intel DMG: $DMG_X64 ($SIZE)"
  else
    echo -e "${RED}✗${NC} Intel DMG not found"
  fi

  if [ -n "$DMG_AARCH64" ]; then
    SIZE=$(du -h "$DMG_AARCH64" | cut -f1)
    echo -e "${GREEN}✓${NC} Apple Silicon DMG: $DMG_AARCH64 ($SIZE)"
  else
    echo -e "${RED}✗${NC} Apple Silicon DMG not found"
  fi

  if [ -d "src-tauri/target/release/bundle/macos/WeiMeng.app" ]; then
    echo -e "${GREEN}✓${NC} macOS App bundle"
  fi
else
  echo -e "${RED}✗${NC} macOS build directory not found"
fi

# Windows artifacts
echo -e "\n${YELLOW}Windows Artifacts:${NC}"
if [ -d "src-tauri/target/release/bundle/nsis" ]; then
  EXE=$(find src-tauri/target/release/bundle/nsis -name "*.exe" 2>/dev/null | head -1)
  if [ -n "$EXE" ]; then
    SIZE=$(du -h "$EXE" | cut -f1)
    echo -e "${GREEN}✓${NC} NSIS Installer: $EXE ($SIZE)"
  fi
else
  echo -e "${RED}✗${NC} Windows NSIS build not found"
fi

if [ -d "src-tauri/target/release/bundle/msi" ]; then
  MSI=$(find src-tauri/target/release/bundle/msi -name "*.msi" 2>/dev/null | head -1)
  if [ -n "$MSI" ]; then
    SIZE=$(du -h "$MSI" | cut -f1)
    echo -e "${GREEN}✓${NC} MSI Package: $MSI ($SIZE)"
  fi
else
  echo -e "${RED}✗${NC} Windows MSI build not found"
fi

# Linux artifacts
echo -e "\n${YELLOW}Linux Artifacts:${NC}"
if [ -d "src-tauri/target/release/bundle/appimage" ]; then
  APPIMAGE=$(find src-tauri/target/release/bundle/appimage -name "*.AppImage" 2>/dev/null | head -1)
  if [ -n "$APPIMAGE" ]; then
    SIZE=$(du -h "$APPIMAGE" | cut -f1)
    echo -e "${GREEN}✓${NC} AppImage: $APPIMAGE ($SIZE)"
  fi
else
  echo -e "${RED}✗${NC} Linux AppImage build not found"
fi

if [ -d "src-tauri/target/release/bundle/deb" ]; then
  DEB=$(find src-tauri/target/release/bundle/deb -name "*.deb" 2>/dev/null | head -1)
  if [ -n "$DEB" ]; then
    SIZE=$(du -h "$DEB" | cut -f1)
    echo -e "${GREEN}✓${NC} DEB Package: $DEB ($SIZE)"
  fi
else
  echo -e "${RED}✗${NC} Linux DEB build not found"
fi

echo -e "\n${GREEN}Build artifact check complete!${NC}"
