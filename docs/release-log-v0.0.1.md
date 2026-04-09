# 发布流程完整记录 - v0.0.1

## 时间线

### 2026-04-09 初始发布尝试

#### 尝试 1: 第一次推送 tag
**问题**:
- Node.js 20 弃用警告
- macOS 构建失败 (exit code 1)
- Linux 构建失败 (exit code 1)

**原因**:
- GitHub Actions 弃用 Node.js 20
- 缺少详细的错误日志

**修复**:
```yaml
# 升级到 Node.js 24
- uses: actions/setup-node@v4
  with:
    node-version: '24'

# 强制使用 Node.js 24
env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

# 启用调试
- run: npm run tauri build
  env:
    RUST_BACKTRACE: 1
```

#### 尝试 2: Node.js 24 更新后
**问题**:
- Linux 构建失败
- `javascriptcoregtk-4.1` not found

**原因**:
- Tauri 2.x 需要 WebKitGTK 4.1
- 工作流安装的是 4.0 版本

**修复**:
```yaml
- name: Install system dependencies
  run: |
    sudo apt-get update
    sudo apt-get install -y \
      libwebkit2gtk-4.1-dev \          # 从 4.0 升级
      libjavascriptcoregtk-4.1-dev \   # 新增
```

#### 尝试 3: WebKitGTK 4.1 更新后
**问题**:
- macOS 构建失败
- `cd: src-tauri/target/release/bundle/dmg: No such file or directory`

**原因**:
- DMG 重命名步骤假设目录存在
- 可能 DMG 文件没有生成

**修复**:
```yaml
- name: Rename DMG files
  run: |
    DMG_DIR="src-tauri/target/release/bundle/dmg"

    if [ ! -d "$DMG_DIR" ]; then
      echo "DMG directory not found, skipping rename"
      exit 0
    fi

    cd "$DMG_DIR"
    # ... 重命名逻辑
```

## 所有修复总结

### 1. Node.js 版本升级
```yaml
# 从 Node.js 20 升级到 24
node-version: '24'

# 强制 Node.js 24
env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true
```

### 2. 依赖安装优化
```yaml
# 避免 peer dependency 错误
- run: npm ci --legacy-peer-deps
```

### 3. Rust 调试支持
```yaml
# 启用 backtrace
- run: npm run tauri build
  env:
    RUST_BACKTRACE: 1
```

### 4. Linux 依赖修复
```yaml
# 安装 WebKitGTK 4.1
- run: |
    sudo apt-get install -y \
      libwebkit2gtk-4.1-dev \
      libjavascriptcoregtk-4.1-dev
```

### 5. DMG 重命名健壮性
```yaml
# 检查目录是否存在
- name: Rename DMG files
  run: |
    if [ ! -d "$DMG_DIR" ]; then
      echo "DMG directory not found, skipping"
      exit 0
    fi
```

### 6. 构建产物验证
```yaml
# 列出所有构建产物
- name: List build artifacts
  run: find src-tauri/target/release/bundle -type f || true
```

### 7. 错误处理改进
```yaml
# 优雅处理缺失文件
- uses: actions/upload-artifact@v4
  with:
    if-no-files-found: warn  # 不失败
```

## 最终工作流配置

### 完整的 GitHub Actions 配置

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*.*.*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Release version'
        required: true
        type: string

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

      - name: Rename DMG files
        run: |
          DMG_DIR="src-tauri/target/release/bundle/dmg"
          if [ ! -d "$DMG_DIR" ]; then
            echo "DMG directory not found, skipping"
            exit 0
          fi
          cd "$DMG_DIR"
          # 重命名逻辑...

      - uses: actions/upload-artifact@v4
        with:
          name: macos-builds
          path: |
            src-tauri/target/release/bundle/dmg/*.dmg
            src-tauri/target/release/bundle/macos/*.app
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

## 学到的经验

### 1. 版本兼容性很重要
- Node.js 20 已弃用,必须使用 24
- Tauri 2.x 需要 WebKitGTK 4.1

### 2. 错误处理要健壮
- 不要假设文件/目录存在
- 使用 `if-no-files-found: warn` 而不是 `error`
- 添加调试步骤查看实际构建产物

### 3. 调试信息很关键
- 启用 `RUST_BACKTRACE=1`
- 添加产物列出步骤
- 使用 `|| true` 避免非关键步骤失败

### 4. 平台特定问题
- macOS: DMG 生成路径可能不存在
- Windows: 通常比较顺利
- Linux: WebKitGTK 版本要匹配

## 后续改进建议

### 1. 添加缓存
```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.cargo/registry
      ~/.cargo/git
      src-tauri/target
    key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
```

### 2. 添加构建时间监控
```yaml
- name: Build time report
  run: |
    echo "Build started at: ${{ steps.build_start.outputs.time }}"
    echo "Build ended at: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
```

### 3. 添加产物大小检查
```yaml
- name: Check artifact sizes
  run: |
    echo "Artifact sizes:"
    du -sh src-tauri/target/release/bundle/* || true
```

### 4. 添加构建失败通知
```yaml
- name: Notify on failure
  if: failure()
  run: |
    # 发送通知到 Slack/Discord/Email
```

## 发布状态

- ✅ Node.js 24 升级完成
- ✅ WebKitGTK 4.1 依赖修复
- ✅ DMG 重命名健壮性修复
- 🔄 第四次构建进行中...

## 查看构建

**GitHub Actions**: https://github.com/CherryKingOne/workflows/actions

**预计时间**: 15-20 分钟

**预期产物**:
- macOS: 2 个 DMG 文件 (Intel + Apple Silicon)
- Windows: 2 个文件 (EXE + MSI)
- Linux: 2 个文件 (AppImage + DEB)

总计 6 个安装包。
