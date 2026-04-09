# Troubleshooting Guide

Common issues and solutions when building and releasing Tauri applications.

## Recent Issues (2026-04-09)

### Node.js 20 Deprecation Warning

**Issue:** GitHub Actions shows deprecation warning
```
Node.js 20 actions are deprecated. Actions will be forced to run with Node.js 24
by default starting June 2nd, 2026.
```

**Solution:**
1. Update Node.js version in workflow:
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '24'
```

2. Add environment variable:
```yaml
env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true
```

### npm ci Peer Dependency Errors

**Issue:** `npm ci` fails with peer dependency conflicts
```
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Solution:**
Use `--legacy-peer-deps` flag:
```yaml
- run: npm ci --legacy-peer-deps
```

### Build Exits with Code 1

**Issue:** Build fails with exit code 1 but no clear error message

**Solution:**
1. Enable Rust backtrace:
```yaml
- run: npm run tauri build
  env:
    RUST_BACKTRACE: 1
```

2. Add artifact listing step:
```yaml
- name: List build artifacts
  run: find src-tauri/target/release/bundle -type f
```

3. Add debug output:
```yaml
- name: Debug build directory
  run: |
    echo "Checking build output..."
    ls -laR src-tauri/target/release/bundle || true
```

### macOS DMG Directory Not Found (2026-04-09)

**Issue:** Build fails with:
```
cd: src-tauri/target/release/bundle/dmg: No such file or directory
```

**Root causes:**
1. Tauri build didn't generate DMG (build failed earlier)
2. Different Tauri version uses different output path
3. Missing or incorrect build configuration

**Solution:**
Make rename step robust to missing directories:
```yaml
- name: Rename DMG files
  run: |
    DMG_DIR="src-tauri/target/release/bundle/dmg"
    
    # Check if directory exists first
    if [ ! -d "$DMG_DIR" ]; then
      echo "DMG directory not found, skipping rename"
      echo "This might indicate Tauri build failed to generate DMG"
      exit 0
    fi
    
    cd "$DMG_DIR"
    
    # Rename DMG files
    if ls *_x64.dmg 1> /dev/null 2>&1; then
      for f in *_x64.dmg; do
        mv "$f" "WeiMeng_${{ steps.get_version.outputs.VERSION }}_x64.dmg"
      done
    fi
    
    if ls *_aarch64.dmg 1> /dev/null 2>&1; then
      for f in *_aarch64.dmg; do
        mv "$f" "WeiMeng_${{ steps.get_version.outputs.VERSION }}_aarch64.dmg"
      done
    fi
    
    ls -lh
```

**Debug steps:**
```yaml
# Add before rename step
- name: List all bundle contents
  run: |
    echo "=== Bundle directory structure ==="
    find src-tauri/target/release/bundle -type d || true
    echo "=== All files in bundle ==="
    find src-tauri/target/release/bundle -type f || true
```

**Prevention:**
1. Always check directory exists before `cd`
2. Use `if-no-files-found: warn` in artifact upload
3. Add verbose logging for build steps
4. Test locally before pushing tags

## Build Issues

### macOS Build Fails

#### Issue: Rust Target Not Found
```
error: can't find crate for `std`
error: could not compile `core`
```

**Solution:**
```bash
# Add Rust targets
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin
```

#### Issue: Xcode Command Line Tools Missing
```
xcrun: error: unable to find utility "xcodebuild"
```

**Solution:**
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Or install full Xcode from App Store
```

#### Issue: Code Signing Fails
```
error: The specified item could not be found in the keychain
```

**Solution:**
1. Check certificate is installed in Keychain
2. Verify signing identity:
   ```bash
   security find-identity -v -p codesigning
   ```
3. Update `tauri.conf.json`:
   ```json
   {
     "bundle": {
       "macOS": {
         "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)"
       }
     }
   }
   ```

#### Issue: Notarization Fails
```
The signature of the binary is invalid
```

**Solution:**
1. Ensure code signing is correct
2. Check Apple ID and app-specific password
3. Verify team ID
4. Check network connectivity

### Windows Build Fails

#### Issue: MSVC Toolchain Not Found
```
error: linker `link.exe` not found
```

**Solution:**
1. Install Visual Studio Build Tools
2. Install Desktop development with C++
3. Restart terminal/IDE

#### Issue: WebView2 Not Found
```
error: WebView2Loader.dll not found
```

**Solution:**
WebView2 is included in Windows 10/11 by default. For older Windows:
1. Download WebView2 Runtime
2. Include in installer or require users to install

#### Issue: Path Too Long
```
error: The filename or extension is too long
```

**Solution:**
Enable long paths in Windows:
```powershell
# Run as Administrator
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
  -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

### Linux Build Fails

#### Issue: Missing GTK Dependencies
```
error: Package 'gtk+-3.0' not found
```

**Solution:**
```bash
# Ubuntu/Debian
sudo apt-get install libgtk-3-dev

# Fedora
sudo dnf install gtk3-devel

# Arch
sudo pacman -S gtk3
```

#### Issue: Missing WebKit Dependencies
```
error: Package 'webkit2gtk-4.0' not found
```

**Solution:**
```bash
# Ubuntu/Debian (use 4.1 for newer Tauri versions)
sudo apt-get install libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev

# For older projects using 4.0
sudo apt-get install libwebkit2gtk-4.0-dev

# Fedora
sudo dnf install webkit2gtk3-devel

# Arch
sudo pacman -S webkit2gtk
```

**Important:** Tauri 2.x requires WebKitGTK 4.1, not 4.0:
```yaml
# GitHub Actions
- name: Install system dependencies
  run: |
    sudo apt-get update
    sudo apt-get install -y \
      libwebkit2gtk-4.1-dev \
      libjavascriptcoregtk-4.1-dev
```

#### Issue: javascriptcoregtk-4.1 Not Found (2026-04-09)

**Issue:** Build fails with:
```
The system library `javascriptcoregtk-4.1` required by crate `javascriptcore-rs-sys` was not found.
```

**Solution:**
Install the correct WebKitGTK 4.1 packages:
```bash
# Ubuntu/Debian
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libjavascriptcoregtk-4.1-dev
```

For GitHub Actions:
```yaml
- name: Install system dependencies
  run: |
    sudo apt-get update
    sudo apt-get install -y \
      libgtk-3-dev \
      libwebkit2gtk-4.1-dev \
      libjavascriptcoregtk-4.1-dev \
      libappindicator3-dev \
      librsvg2-dev \
      patchelf
```
```

#### Issue: Missing Other Dependencies
```
error: Package 'libappindicator3-0.1' not found
```

**Solution:**
```bash
# Install all required dependencies
sudo apt-get install -y \
  libgtk-3-dev \
  libwebkit2gtk-4.0-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf
```

## Release Issues

### GitHub Actions Failures

#### Issue: Out of Memory
```
error: Process completed with exit code 137
```

**Solution:**
1. Reduce parallel jobs
2. Add swap space in workflow:
   ```yaml
   - name: Configure swap
     run: |
       sudo fallocate -l 4G /swapfile
       sudo chmod 600 /swapfile
       sudo mkswap /swapfile
       sudo swapon /swapfile
   ```

#### Issue: Timeout
```
Error: The operation was canceled
```

**Solution:**
1. Increase timeout:
   ```yaml
   jobs:
     build:
       timeout-minutes: 60  # Default is 360
   ```

#### Issue: Permission Denied
```
error: Permission denied (publickey)
```

**Solution:**
1. Check repository permissions
2. Verify `GITHUB_TOKEN` is set
3. Check workflow permissions:
   ```yaml
   permissions:
     contents: write
   ```

### Release Not Created

#### Issue: Tag Format Incorrect
```
Workflow not triggered
```

**Solution:**
Ensure tag format matches pattern:
```bash
# Correct
git tag v1.0.0
git push origin v1.0.0

# Incorrect (won't trigger)
git tag 1.0.0        # Missing 'v' prefix
git tag v1.0         # Missing patch version
```

#### Issue: GitHub Token Missing
```
Error: Resource not accessible by integration
```

**Solution:**
1. Check workflow has access to secrets:
   ```yaml
   env:
     GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
   ```
2. Verify repository settings allow Actions to create releases

### Artifacts Missing

#### Issue: No Files Uploaded
```
Warning: No files were found
```

**Solution:**
1. Check build output directory
2. Verify artifact path:
   ```yaml
   - uses: actions/upload-artifact@v4
     with:
       name: macos-builds
       path: src-tauri/target/release/bundle/dmg/*.dmg
   ```
3. Add debug step:
   ```yaml
   - name: List files
     run: find src-tauri/target/release/bundle -type f
   ```

## Runtime Issues

### macOS: App Won't Open

#### Issue: App is Damaged
```
"App" is damaged and can't be opened
```

**Solution:**
1. Remove quarantine attribute:
   ```bash
   xattr -cr /path/to/WeiMeng.app
   ```
2. Or allow in System Preferences:
   - Security & Privacy → General → Open Anyway

#### Issue: Unsigned App Warning
```
Cannot verify developer
```

**Solution:**
1. Right-click app → Open
2. Or code sign the application
3. Or allow in System Preferences

### Windows: SmartScreen Warning

#### Issue: Windows Protected Your PC
```
Microsoft Defender SmartScreen prevented an unrecognized app from starting
```

**Solution:**
1. Click "More info" → "Run anyway"
2. Or code sign with trusted certificate
3. Build reputation over time

### Linux: Missing Libraries

#### Issue: Library Not Found
```
error while loading shared libraries: libwebkit2gtk-4.0.so.37
```

**Solution:**
```bash
# Ubuntu/Debian
sudo apt-get install libwebkit2gtk-4.0-37

# Or use AppImage (includes dependencies)
./WeiMeng_0.0.1_x64.AppImage
```

## Performance Issues

### Slow Build Times

**Solutions:**

1. **Enable Caching:**
   ```yaml
   - uses: actions/cache@v4
     with:
       path: |
         ~/.cargo/registry
         ~/.cargo/git
         src-tauri/target
       key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
   ```

2. **Use Incremental Builds:**
   ```toml
   # Cargo.toml
   [profile.release]
   incremental = true
   ```

3. **Optimize Dependencies:**
   - Remove unused crates
   - Use smaller alternatives
   - Disable unnecessary features

### Large Binary Size

**Solutions:**

1. **Strip Binary:**
   ```yaml
   - name: Strip binary
     run: strip src-tauri/target/release/WeiMeng
   ```

2. **Optimize Cargo.toml:**
   ```toml
   [profile.release]
   opt-level = "z"     # Optimize for size
   lto = true          # Link-time optimization
   codegen-units = 1   # Better optimization
   strip = true        # Strip symbols
   ```

3. **Compress Assets:**
   - Minify JavaScript/CSS
   - Optimize images
   - Use WebP instead of PNG

## Debug Tips

### Enable Verbose Logging

**GitHub Actions:**
```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

**Tauri Build:**
```bash
RUST_BACKTRACE=1 npm run tauri build
```

**Cargo Build:**
```bash
RUST_LOG=debug cargo build --release
```

### Check Build Logs

1. Go to Actions tab in GitHub
2. Select the failed workflow run
3. Expand each step to see logs
4. Look for error messages or warnings

### Local Testing

Test builds locally before pushing:

```bash
# macOS
npm run tauri build -- --target x86_64-apple-darwin

# Test the built app
open src-tauri/target/release/bundle/macos/WeiMeng.app
```

### Common Debug Commands

```bash
# Check Rust version
rustc --version
cargo --version

# Check installed targets
rustup target list --installed

# Check node version
node --version
npm --version

# Verify Tauri CLI
npm run tauri -- --version

# Check dependencies
cargo tree
npm list
```

## Getting Help

1. **Tauri Documentation:** https://tauri.app/v2/guides/
2. **Tauri Discord:** https://discord.com/invite/tauri
3. **GitHub Issues:** https://github.com/tauri-apps/tauri/issues
4. **Stack Overflow:** Tag questions with `tauri`

When asking for help, include:
- Operating system and version
- Rust version (`rustc --version`)
- Node.js version (`node --version`)
- Tauri version
- Error messages and logs
- Steps to reproduce
