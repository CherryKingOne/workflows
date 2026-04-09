# Quick Reference

Quick commands and snippets for Tauri multi-platform releases.

## Latest Updates (2026-04-09)

### Node.js 24 Required

```yaml
# Always use Node.js 24
- uses: actions/setup-node@v4
  with:
    node-version: '24'
    cache: 'npm'

# Force Node.js 24 globally
env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true
```

### npm ci with Legacy Peer Deps

```yaml
# Avoid peer dependency errors
- run: npm ci --legacy-peer-deps
```

### Enable Rust Debug Output

```yaml
# Better error messages
- run: npm run tauri build
  env:
    RUST_BACKTRACE: 1
```

### Verify Build Artifacts

```yaml
# Always check what was built
- name: List build artifacts
  run: find src-tauri/target/release/bundle -type f
```

## Essential Commands

### Build Commands

```bash
# Development
npm run tauri:dev

# Production build (current platform)
npm run tauri:build

# macOS Intel
npm run tauri build -- --target x86_64-apple-darwin

# macOS Apple Silicon
npm run tauri build -- --target aarch64-apple-darwin

# Windows (on Windows)
npm run tauri build

# Linux (on Linux)
npm run tauri build
```

### Git Commands

```bash
# Create and push tag
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Delete tag
git tag -d v1.0.0
git push --delete origin v1.0.0

# List tags
git tag -l

# Show tag details
git show v1.0.0
```

### Version Management

```bash
# Using npm version
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0

# Using custom script
./scripts/release.sh patch
./scripts/release.sh minor
./scripts/release.sh major
```

## File Locations

### Build Artifacts

```
macOS:
  src-tauri/target/release/bundle/dmg/WeiMeng_x.x.x_x64.dmg
  src-tauri/target/release/bundle/dmg/WeiMeng_x.x.x_aarch64.dmg
  src-tauri/target/release/bundle/macos/WeiMeng.app

Windows:
  src-tauri/target/release/bundle/nsis/WeiMeng_x.x.x_x64-setup.exe
  src-tauri/target/release/bundle/msi/WeiMeng_x.x.x_x64.msi

Linux:
  src-tauri/target/release/bundle/appimage/WeiMeng_x.x.x_x64.AppImage
  src-tauri/target/release/bundle/deb/WeiMeng_x.x.x_amd64.deb
```

### Configuration Files

```
package.json                    # npm version
src-tauri/tauri.conf.json       # Tauri config, version
.github/workflows/release.yml   # GitHub Actions
CHANGELOG.md                    # Release notes
```

## GitHub Actions Snippets

### Basic Workflow

```yaml
name: Release
on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: dtolnay/rust-toolchain@stable
      - run: npm ci
      - run: npm run tauri build
      - uses: softprops/action-gh-release@v1
        with:
          files: src-tauri/target/release/bundle/**/*
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Matrix Build

```yaml
jobs:
  build:
    strategy:
      matrix:
        platform: [macos-latest, windows-latest, ubuntu-22.04]
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run tauri build
```

### Conditional Build

```yaml
jobs:
  build-macos:
    if: "!contains(github.event.head_commit.message, '[skip mac]')"

  build-windows:
    if: "!contains(github.event.head_commit.message, '[skip win]')"

  build-linux:
    if: "!contains(github.event.head_commit.message, '[skip linux]')"
```

## Platform Dependencies

### macOS

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Add Rust targets
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin
```

### Windows

```powershell
# Install Visual Studio Build Tools
# Download from: https://visualstudio.microsoft.com/downloads/

# Or use winget
winget install Microsoft.VisualStudio.2022.BuildTools
```

### Linux (Ubuntu/Debian)

```bash
# Tauri 2.x (WebKitGTK 4.1)
sudo apt-get update
sudo apt-get install -y \
  libgtk-3-dev \
  libwebkit2gtk-4.1-dev \
  libjavascriptcoregtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf

# Tauri 1.x (WebKitGTK 4.0)
sudo apt-get install -y \
  libgtk-3-dev \
  libwebkit2gtk-4.0-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf
```

## Code Signing

### macOS

```bash
# List signing identities
security find-identity -v -p codesigning

# Sign app
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: Your Name" \
  --options runtime \
  WeiMeng.app

# Notarize
xcrun notarytool submit WeiMeng.dmg \
  --apple-id "your@email.com" \
  --password "@keychain:AC_PASSWORD" \
  --team-id "TEAM_ID" \
  --wait
```

### Windows

```powershell
# Sign executable
signtool sign /f certificate.pfx /p password /t http://timestamp.digicert.com WeiMeng.exe

# Verify signature
signtool verify /pa WeiMeng.exe
```

## Useful npm Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "release:patch": "npm version patch && git push --follow-tags",
    "release:minor": "npm version minor && git push --follow-tags",
    "release:major": "npm version major && git push --follow-tags"
  }
}
```

## Environment Variables

### Build

```bash
# Enable backtrace
RUST_BACKTRACE=1

# Enable debug logging
RUST_LOG=debug

# Target platform
TAURI_PLATFORM=macos  # or windows, linux
```

### GitHub Actions

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
  APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
  WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
```

## Verification Commands

### macOS

```bash
# Check architecture
lipo -archs WeiMeng.app/Contents/MacOS/WeiMeng

# Verify code signature
codesign --verify --deep --strict --verbose=2 WeiMeng.app

# Check notarization
spctl --assess --verbose WeiMeng.app
```

### Windows

```powershell
# Get file hash
Get-FileHash WeiMeng.exe -Algorithm SHA256

# Check signature
Get-AuthenticodeSignature WeiMeng.exe

# Test installation
msiexec /i WeiMeng.msi /quiet
```

### Linux

```bash
# Check DEB package
dpkg-deb --info WeiMeng.deb
dpkg-deb --contents WeiMeng.deb

# Check AppImage
sha256sum WeiMeng.AppImage

# Test AppImage
chmod +x WeiMeng.AppImage
./WeiMeng.AppImage --appimage-help
```

## Common Patterns

### Release Checklist

```markdown
- [ ] Update version in package.json
- [ ] Update version in tauri.conf.json
- [ ] Update CHANGELOG.md
- [ ] Test build locally
- [ ] Commit changes
- [ ] Create tag
- [ ] Push tag
- [ ] Verify GitHub Actions
- [ ] Check Release page
- [ ] Download and test artifacts
```

### CHANGELOG Template

```markdown
## [X.X.X] - YYYY-MM-DD

### Added
- Feature description

### Changed
- Change description

### Fixed
- Bug fix description

### Breaking Changes
- Breaking change description (major versions only)

### Dependencies
- Updated dependency X to version Y
```

## Debug URLs

- GitHub Actions: `https://github.com/{owner}/{repo}/actions`
- Releases: `https://github.com/{owner}/{repo}/releases`
- Workflow: `https://github.com/{owner}/{repo}/actions/workflows/release.yml`
- Latest release: `https://github.com/{owner}/{repo}/releases/latest`

## Time Estimates

- Local build: 2-5 minutes
- GitHub Actions build (single platform): 10-15 minutes
- GitHub Actions build (all platforms): 15-20 minutes
- Code signing: 1-2 minutes
- Notarization: 5-10 minutes

## File Sizes

Approximate sizes for a basic Tauri app:

- macOS DMG: 6-8 MB
- Windows EXE: 8-10 MB
- Linux AppImage: 10-12 MB
