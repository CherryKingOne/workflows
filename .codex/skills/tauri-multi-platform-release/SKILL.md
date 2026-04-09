# Tauri Multi-Platform Release Skill

This skill provides comprehensive guidance for releasing Tauri applications to multiple platforms (macOS, Windows, Linux) using GitHub Actions automation.

## When to Use This Skill

Use this skill when:
- Setting up automated multi-platform release workflows for Tauri applications
- Creating GitHub Actions workflows for building Tauri apps
- Implementing automated version bumping and release processes
- Configuring cross-platform builds for desktop applications
- Troubleshooting release pipeline issues

## Quick Start

### 1. Basic GitHub Actions Workflow

Create `.github/workflows/release.yml` for automated multi-platform builds:

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*.*.*'

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

jobs:
  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-apple-darwin,x86_64-apple-darwin
      - run: npm ci --legacy-peer-deps
      - run: npm run build
      - run: npm run tauri build -- --target x86_64-apple-darwin
        env:
          RUST_BACKTRACE: 1
      - run: npm run tauri build -- --target aarch64-apple-darwin
        env:
          RUST_BACKTRACE: 1
      - run: find src-tauri/target/release/bundle -type f
      - uses: actions/upload-artifact@v4
        with:
          name: macos-builds
          path: src-tauri/target/release/bundle/dmg/*.dmg
          if-no-files-found: warn

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
      - uses: dtolnay/rust-toolchain@stable
      - run: npm ci --legacy-peer-deps
      - run: npm run build
      - run: npm run tauri build
        env:
          RUST_BACKTRACE: 1
      - uses: actions/upload-artifact@v4
        with:
          name: windows-builds
          path: |
            src-tauri/target/release/bundle/msi/*.msi
            src-tauri/target/release/bundle/nsis/*.exe
          if-no-files-found: warn

  build-linux:
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
      - uses: dtolnay/rust-toolchain@stable
      - run: |
          sudo apt-get update
          sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev patchelf
      - run: npm ci --legacy-peer-deps
      - run: npm run build
      - run: npm run tauri build
        env:
          RUST_BACKTRACE: 1
      - uses: actions/upload-artifact@v4
        with:
          name: linux-builds
          path: |
            src-tauri/target/release/bundle/deb/*.deb
            src-tauri/target/release/bundle/appimage/*.AppImage
          if-no-files-found: warn

  create-release:
    needs: [build-macos, build-windows, build-linux]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          path: artifacts
      - uses: softprops/action-gh-release@v1
        with:
          files: artifacts/**/*
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 2. Release Script

Create `scripts/release.sh` for automated version bumping:

```bash
#!/bin/bash
set -e

# Determine version bump type
BUMP_TYPE=${1:-patch}

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")

# Calculate new version
case $BUMP_TYPE in
  major)
    NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$1++; $2=0; $3=0} 1' OFS=.)
    ;;
  minor)
    NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$2++; $3=0} 1' OFS=.)
    ;;
  patch)
    NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$3++} 1' OFS=.)
    ;;
esac

# Update package.json
npm version $NEW_VERSION --no-git-tag-version

# Update tauri.conf.json
node -e "const fs = require('fs'); const conf = JSON.parse(fs.readFileSync('./src-tauri/tauri.conf.json', 'utf8')); conf.version = '$NEW_VERSION'; fs.writeFileSync('./src-tauri/tauri.conf.json', JSON.stringify(conf, null, 2));"

# Commit and tag
git add package.json src-tauri/tauri.conf.json
git commit -m "chore: bump version to ${NEW_VERSION}"
git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}"
git push origin main
git push origin "v${NEW_VERSION}"
```

Usage:
```bash
chmod +x scripts/release.sh
./scripts/release.sh patch  # 0.0.1 -> 0.0.2
./scripts/release.sh minor  # 0.0.1 -> 0.1.0
./scripts/release.sh major  # 0.0.1 -> 1.0.0
```

## Platform-Specific Details

### macOS Builds

**Build Artifacts:**
- `WeiMeng_x.x.x_x64.dmg` - Intel Mac
- `WeiMeng_x.x.x_aarch64.dmg` - Apple Silicon (M1/M2/M3)

**Requirements:**
- macOS 10.15 (Catalina) or later
- Xcode Command Line Tools

**Dual Architecture:**
```bash
# Build for Intel
npm run tauri build -- --target x86_64-apple-darwin

# Build for Apple Silicon
npm run tauri build -- --target aarch64-apple-darwin
```

**Code Signing (Optional):**
```yaml
env:
  APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
  APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
  APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
  APPLE_ID: ${{ secrets.APPLE_ID }}
  APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
```

### Windows Builds

**Build Artifacts:**
- `WeiMeng_x.x.x_x64-setup.exe` - NSIS Installer
- `WeiMeng_x.x.x_x64.msi` - MSI Package

**Requirements:**
- Windows 10 or later
- Visual Studio Build Tools

**Code Signing (Optional):**
```yaml
env:
  WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
  WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
```

### Linux Builds

**Build Artifacts:**
- `WeiMeng_x.x.x_x64.AppImage` - Universal format
- `WeiMeng_x.x.x_amd64.deb` - Debian/Ubuntu package

**Requirements:**
- Ubuntu 18.04+ or equivalent
- Required libraries:
  ```bash
  sudo apt-get install -y \
    libgtk-3-dev \
    libwebkit2gtk-4.0-dev \
    libappindicator3-dev \
    librsvg2-dev \
    patchelf
  ```

## Release Workflow

### Manual Release Process

1. **Update Version:**
   ```bash
   npm version patch  # or minor, major
   ```

2. **Update tauri.conf.json:**
   Manually edit `src-tauri/tauri.conf.json` version field

3. **Commit Changes:**
   ```bash
   git add package.json src-tauri/tauri.conf.json
   git commit -m "chore: bump version to x.x.x"
   ```

4. **Create Tag:**
   ```bash
   git tag -a vx.x.x -m "Release version x.x.x"
   ```

5. **Push:**
   ```bash
   git push origin main
   git push origin vx.x.x
   ```

### Automated Release Process

Using the release script:
```bash
./scripts/release.sh patch "Bug fixes and improvements"
```

This automatically:
1. Updates version numbers
2. Creates git commit
3. Creates annotated tag
4. Pushes to GitHub
5. Triggers GitHub Actions

## GitHub Actions Optimization

### Parallel Builds

All platforms build in parallel:
```
macOS (~15 min)  ┐
Windows (~10 min)├─> Total: ~15-20 min
Linux (~10 min)  ┘
```

### Caching

Add caching for faster builds:
```yaml
- name: Cache Cargo
  uses: actions/cache@v4
  with:
    path: |
      ~/.cargo/registry
      ~/.cargo/git
      src-tauri/target
    key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

- name: Cache npm
  uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
```

### Conditional Builds

Build specific platforms based on conditions:
```yaml
jobs:
  build-macos:
    if: contains(github.event.head_commit.message, '[macos]') || !contains(github.event.head_commit.message, '[')

  build-windows:
    if: contains(github.event.head_commit.message, '[windows]') || !contains(github.event.head_commit.message, '[')

  build-linux:
    if: contains(github.event.head_commit.message, '[linux]') || !contains(github.event.head_commit.message, '[')
```

## Troubleshooting

### Common Issues

**1. macOS Build Fails**
- Check Rust targets are installed
- Verify Xcode Command Line Tools
- Check code signing configuration

**2. Windows Build Fails**
- Ensure MSVC toolchain is used
- Check Windows SDK installation
- Verify MSBuild path

**3. Linux Build Fails**
- Install all required dependencies
- Check WebKit2GTK version
- Verify GTK3 installation

**4. Release Not Created**
- Verify tag format: `v*.*.*`
- Check GitHub Token permissions
- Review Actions execution status

**5. Artifacts Missing**
- Check build job success
- Verify artifact upload paths
- Review GitHub Actions logs

### Debugging

Enable debug logging:
```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

Check build logs:
```
https://github.com/{owner}/{repo}/actions/runs/{run_id}
```

## Best Practices

### Version Management
- Follow Semantic Versioning (SemVer)
- Update CHANGELOG.md with each release
- Keep version consistent across package.json and tauri.conf.json

### Release Notes
```markdown
## vX.X.X - YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing features

### Fixed
- Bug fixes

### Breaking Changes
- Breaking changes (major versions only)
```

### Pre-Releases
Use version suffixes for pre-releases:
- `v1.0.0-alpha.1`
- `v1.0.0-beta.1`
- `v1.0.0-rc.1`

GitHub Actions configuration:
```yaml
prerelease: ${{ contains(steps.get_version.outputs.VERSION, '-') }}
```

### Security
- Never commit secrets to repository
- Use GitHub Secrets for sensitive data
- Enable branch protection rules
- Require status checks before merging

## Advanced Features

### Auto-Update Support

Configure Tauri updater:
```json
// src-tauri/tauri.conf.json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": ["https://github.com/{owner}/{repo}/releases/latest/download"],
      "pubkey": "YOUR_PUBLIC_KEY"
    }
  }
}
```

### Notarization (macOS)

Add notarization step:
```yaml
- name: Notarize
  run: |
    xcrun notarytool submit \
      src-tauri/target/release/bundle/dmg/WeiMeng.dmg \
      --apple-id "$APPLE_ID" \
      --password "$APPLE_PASSWORD" \
      --team-id "$TEAM_ID" \
      --wait
```

### Multi-Architecture Binaries

Create universal binary for macOS:
```bash
# Build both architectures
npm run tauri build -- --target x86_64-apple-darwin
npm run tauri build -- --target aarch64-apple-darwin

# Create universal binary
lipo -create \
  src-tauri/target/x86_64-apple-darwin/release/WeiMeng \
  src-tauri/target/aarch64-apple-darwin/release/WeiMeng \
  -output src-tauri/target/release/WeiMeng
```

## File Structure

```
project/
├── .github/
│   └── workflows/
│       └── release.yml          # GitHub Actions workflow
├── scripts/
│   └── release.sh               # Release automation script
├── docs/
│   ├── release-process.md       # Release documentation
│   ├── multi-platform-build.md  # Platform-specific details
│   └── platform-support.md      # Platform support overview
├── CHANGELOG.md                 # Version history
├── package.json                 # Version management
└── src-tauri/
    └── tauri.conf.json          # Tauri configuration
```

## Resources

- [Tauri Distribution Guide](https://tauri.app/v2/guides/distribute/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Semantic Versioning](https://semver.org/)
- [Tauri Updater Plugin](https://tauri.app/v2/guides/distribute/updater/)

## Important Updates and Fixes

### Node.js Version Update (2026-04-09)

GitHub Actions deprecated Node.js 20. **Always use Node.js 24**:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '24'
    cache: 'npm'
```

Add environment variable to force Node.js 24:
```yaml
env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true
```

### Dependency Installation Issues

If `npm ci` fails with peer dependency errors, use:
```yaml
- run: npm ci --legacy-peer-deps
```

### Build Debugging

Enable Rust backtrace for better error messages:
```yaml
- run: npm run tauri build
  env:
    RUST_BACKTRACE: 1
```

### Artifact Verification

Always add steps to verify build artifacts:
```yaml
- name: List build artifacts
  run: find src-tauri/target/release/bundle -type f
```

### Handle Missing Artifacts Gracefully

Use `if-no-files-found` to avoid build failures:
```yaml
- uses: actions/upload-artifact@v4
  with:
    name: macos-builds
    path: src-tauri/target/release/bundle/dmg/*.dmg
    if-no-files-found: warn  # or 'error' to fail
```

### Common Build Failures

**Issue: Missing package-lock.json**
```bash
# Generate lock file locally
npm install
# Commit the file
git add package-lock.json
git commit -m "chore: add package-lock.json"
```

**Issue: Build artifacts not found**
```yaml
# Add debug step
- name: Debug - Show bundle directory
  run: |
    echo "Bundle directory contents:"
    ls -laR src-tauri/target/release/bundle || true
```

**Issue: Rust target not installed**
```yaml
# Ensure Rust targets are added
- uses: dtolnay/rust-toolchain@stable
  with:
    targets: aarch64-apple-darwin,x86_64-apple-darwin
```

### Best Practices Checklist

Before triggering a release:

- [ ] Update `package.json` version
- [ ] Update `src-tauri/tauri.conf.json` version
- [ ] Update `CHANGELOG.md` with release notes
- [ ] Ensure `package-lock.json` is committed
- [ ] Test build locally: `npm run tauri build`
- [ ] Verify all dependencies are in `package.json`
- [ ] Check Node.js version is 24+
- [ ] Verify Rust targets are installed

### Release Workflow Template

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*.*.*'

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

jobs:
  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: aarch64-apple-darwin,x86_64-apple-darwin
      - run: npm ci --legacy-peer-deps
      - run: npm run build
      - run: npm run tauri build -- --target x86_64-apple-darwin
        env:
          RUST_BACKTRACE: 1
      - run: npm run tauri build -- --target aarch64-apple-darwin
        env:
          RUST_BACKTRACE: 1
      - run: find src-tauri/target/release/bundle -type f
      - uses: actions/upload-artifact@v4
        with:
          name: macos-builds
          path: src-tauri/target/release/bundle/dmg/*.dmg
          if-no-files-found: warn
```

## Example Implementation

For a complete working example, see:
- `.github/workflows/release.yml` - Full multi-platform workflow
- `scripts/release.sh` - Automated version bumping
- `docs/release-process.md` - Comprehensive documentation
- `CHANGELOG.md` - Version tracking template
