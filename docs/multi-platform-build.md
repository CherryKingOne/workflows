# 多平台构建说明

## 构建产物概览

发布时会自动构建以下所有平台的安装包:

### macOS
- **Intel Mac**: `WeiMeng_x.x.x_x64.dmg`
- **Apple Silicon (M1/M2/M3)**: `WeiMeng_x.x.x_aarch64.dmg`
- 运行环境: `macos-latest` (GitHub Actions)

### Windows
- **安装程序**: `WeiMeng_x.x.x_x64-setup.exe` (NSIS 安装器)
- **MSI 包**: `WeiMeng_x.x.x_x64.msi` (企业部署)
- 运行环境: `windows-latest` (GitHub Actions)

### Linux
- **AppImage**: `WeiMeng_x.x.x_x64.AppImage` (通用格式,无需安装)
- **DEB 包**: `WeiMeng_x.x.x_amd64.deb` (Debian/Ubuntu)
- 运行环境: `ubuntu-22.04` (GitHub Actions)

## 构建流程

GitHub Actions 工作流包含 4 个作业 (jobs):

1. **build-macos**: 构建 macOS 版本 (Intel + Apple Silicon)
2. **build-windows**: 构建 Windows 版本
3. **build-linux**: 构建 Linux 版本
4. **create-release**: 收集所有构建产物并创建 Release

```
┌─────────────┐  ┌──────────────┐  ┌─────────────┐
│ build-macos │  │ build-windows│  │ build-linux │
└──────┬──────┘  └──────┬───────┘  └──────┬──────┘
       │                │                  │
       │                │                  │
       └────────────────┼──────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │  create-release  │
              └──────────────────┘
```

## 系统要求

### macOS
- macOS 10.15 (Catalina) 或更高版本
- 支持 Intel 和 Apple Silicon 处理器

### Windows
- Windows 10 或更高版本
- x64 架构

### Linux
- Ubuntu 18.04+ 或等效发行版
- x64 架构
- AppImage 需要以下库 (通常已预装):
  - GTK3
  - WebKit2GTK
  - libappindicator

## 构建时间预估

每个平台的构建时间:
- **macOS**: ~15-20 分钟
- **Windows**: ~10-15 分钟
- **Linux**: ~10-15 分钟

所有平台并行构建,总时间约 15-20 分钟。

## 平台特定配置

### macOS 代码签名 (可选)

如果需要对 macOS 应用进行代码签名,需要配置:

```yaml
env:
  APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
  APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
  APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
  APPLE_ID: ${{ secrets.APPLE_ID }}
  APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
```

### Windows 代码签名 (可选)

如果需要对 Windows 应用进行代码签名:

```yaml
env:
  WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
  WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
```

### Linux 依赖

Linux 构建需要安装以下系统依赖:

```bash
sudo apt-get install -y \
  libgtk-3-dev \
  libwebkit2gtk-4.0-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf
```

这些已在工作流中自动配置。

## 发布产物示例

假设版本号为 `0.0.1`,Release 页面将包含:

```
WeiMeng v0.0.1
├── WeiMeng_0.0.1_x64.dmg          (macOS Intel)
├── WeiMeng_0.0.1_aarch64.dmg      (macOS Apple Silicon)
├── WeiMeng_0.0.1_x64-setup.exe    (Windows 安装器)
├── WeiMeng_0.0.1_x64.msi          (Windows MSI)
├── WeiMeng_0.0.1_x64.AppImage     (Linux AppImage)
└── WeiMeng_0.0.1_amd64.deb        (Linux DEB)
```

## 手动测试各平台构建

### 本地测试 macOS
```bash
npm run tauri build
# 产物: src-tauri/target/release/bundle/dmg/
```

### 本地测试 Windows (需要 Windows 环境)
```powershell
npm run tauri build
# 产物: src-tauri/target/release/bundle/msi/
#       src-tauri/target/release/bundle/nsis/
```

### 本地测试 Linux (需要 Linux 环境)
```bash
npm run tauri build
# 产物: src-tauri/target/release/bundle/deb/
#       src-tauri/target/release/bundle/appimage/
```

## 跳过特定平台

如果不想构建某个平台,可以:

1. 在工作流文件中删除对应的 job
2. 或者在 `create-release` 的 `needs` 中移除该平台

例如,只构建 macOS 和 Windows:

```yaml
create-release:
  needs: [build-macos, build-windows]  # 移除 build-linux
```

## 故障排查

### macOS 构建失败
- 检查 Rust target 是否正确安装
- 验证 Xcode 命令行工具配置

### Windows 构建失败
- 确认使用正确的 MSVC target
- 检查 Windows SDK 安装

### Linux 构建失败
- 确认所有系统依赖已安装
- 检查 WebKit2GTK 版本兼容性

### Release 未包含某个平台的产物
- 检查对应 job 是否成功
- 验证文件路径是否正确
- 查看 artifact 上传日志

## 进阶配置

### 仅构建特定平台

创建多个独立的工作流文件:

- `.github/workflows/release-macos.yml`
- `.github/workflows/release-windows.yml`
- `.github/workflows/release-linux.yml`

然后通过不同的 tag 触发:

```yaml
on:
  push:
    tags:
      - 'v*-macos'   # 只构建 macOS
```

### 添加自动更新支持

Tauri 支持应用内自动更新:

```json
// src-tauri/tauri.conf.json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": ["https://github.com/user/repo/releases/latest/download"],
      "pubkey": "YOUR_PUBLIC_KEY"
    }
  }
}
```

详见: https://tauri.app/v2/guides/distribute/updater/
