# Build Artifacts Reference

This document provides detailed information about build artifacts for each platform.

## macOS Artifacts

### DMG (Disk Image)
- **Format**: `.dmg`
- **Purpose**: Primary distribution format for macOS
- **Architectures**:
  - `x64` - Intel-based Macs
  - `aarch64` - Apple Silicon (M1/M2/M3)
- **Location**: `src-tauri/target/release/bundle/dmg/`
- **File naming**: `WeiMeng_{version}_{arch}.dmg`

#### Creation
```bash
npm run tauri build -- --target x86_64-apple-darwin
npm run tauri build -- --target aarch64-apple-darwin
```

#### DMG Features
- Compressed disk image
- Custom background and icon positioning
- Drag-to-install interface
- Code signing support
- Notarization support

### APP Bundle
- **Format**: `.app`
- **Purpose**: Application bundle for development/testing
- **Location**: `src-tauri/target/release/bundle/macos/`
- **Structure**:
  ```
  WeiMeng.app/
  └── Contents/
      ├── MacOS/
      │   └── WeiMeng          # Executable
      ├── Resources/
      │   └── app.icns         # Icon
      ├── Info.plist           # App metadata
      └── PkgInfo
      ```

## Windows Artifacts

### NSIS Installer
- **Format**: `.exe`
- **Purpose**: User-friendly installer for Windows
- **Location**: `src-tauri/target/release/bundle/nsis/`
- **File naming**: `WeiMeng_{version}_x64-setup.exe`

#### Features
- Graphical installer interface
- Start menu shortcuts
- Uninstaller included
- Custom install location
- Registry entries

#### Creation
```bash
npm run tauri build
```

### MSI Package
- **Format**: `.msi`
- **Purpose**: Enterprise deployment and automation
- **Location**: `src-tauri/target/release/bundle/msi/`
- **File naming**: `WeiMeng_{version}_x64.msi`

#### Features
- Windows Installer format
- Group Policy deployment
- Silent installation support
- Repair/uninstall support

#### Silent Install
```cmd
msiexec /i WeiMeng_0.0.1_x64.msi /quiet
```

## Linux Artifacts

### AppImage
- **Format**: `.AppImage`
- **Purpose**: Universal Linux package
- **Location**: `src-tauri/target/release/bundle/appimage/`
- **File naming**: `WeiMeng_{version}_x64.AppImage`

#### Features
- No installation required
- Single executable file
- Portable across distributions
- Self-contained dependencies

#### Usage
```bash
chmod +x WeiMeng_0.0.1_x64.AppImage
./WeiMeng_0.0.1_x64.AppImage
```

#### Supported Distributions
- Ubuntu 18.04+
- Debian 10+
- Fedora 30+
- openSUSE Leap 15+
- Arch Linux
- Most other modern distributions

### DEB Package
- **Format**: `.deb`
- **Purpose**: Debian/Ubuntu package manager
- **Location**: `src-tauri/target/release/bundle/deb/`
- **File naming**: `WeiMeng_{version}_amd64.deb`

#### Features
- Native package manager integration
- Dependency management
- Easy updates via apt
- System integration

#### Installation
```bash
sudo dpkg -i WeiMeng_0.0.1_amd64.deb
sudo apt-get install -f  # Install dependencies
```

#### Uninstallation
```bash
sudo apt-get remove weimeng
```

## Artifact Sizes

Approximate sizes for a basic Tauri app:

| Platform | Format | Size (Compressed) | Size (Uncompressed) |
|----------|--------|-------------------|---------------------|
| macOS    | DMG    | 6-8 MB           | 15-20 MB           |
| Windows  | EXE    | 8-10 MB          | 20-25 MB           |
| Windows  | MSI    | 8-10 MB          | 20-25 MB           |
| Linux    | AppImage | 10-12 MB       | 25-30 MB           |
| Linux    | DEB    | 8-10 MB          | 20-25 MB           |

## Artifact Contents

### Common Files
- Compiled executable
- Frontend assets (HTML/CSS/JS)
- Static resources
- Application metadata

### Platform-Specific Files

#### macOS
- `Info.plist` - Application metadata
- `app.icns` - Application icon
- Code signature (if signed)
- Notarization ticket (if notarized)

#### Windows
- `app.exe` - Main executable
- `app.ico` - Application icon
- Resources and DLLs
- Code signature (if signed)

#### Linux
- `usr/share/applications/` - Desktop entry
- `usr/share/icons/` - Application icons
- `usr/bin/` - Executable
- `usr/lib/` - Libraries

## Verification

### macOS
```bash
# Verify DMG
hdiutil attach WeiMeng_0.0.1_x64.dmg
ls /Volumes/WeiMeng/

# Verify signature
codesign --verify --deep --strict WeiMeng.app

# Check architecture
lipo -archs WeiMeng.app/Contents/MacOS/WeiMeng
```

### Windows
```powershell
# Verify EXE
Get-FileHash WeiMeng_0.0.1_x64-setup.exe -Algorithm SHA256

# Verify signature
Get-AuthenticodeSignature WeiMeng_0.0.1_x64-setup.exe
```

### Linux
```bash
# Verify AppImage
sha256sum WeiMeng_0.0.1_x64.AppImage

# Verify DEB
dpkg-deb --info WeiMeng_0.0.1_amd64.deb
dpkg-deb --contents WeiMeng_0.0.1_amd64.deb
```

## Cleanup

### macOS
```bash
# Detach DMG
hdiutil detach /Volumes/WeiMeng
```

### Windows
No cleanup required after installation.

### Linux
```bash
# Remove AppImage
rm WeiMeng_0.0.1_x64.AppImage

# Remove DEB
sudo apt-get remove weimeng
```
