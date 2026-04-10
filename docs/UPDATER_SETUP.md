# Tauri Updater 配置指南

本文档说明如何配置 Tauri 后台静默更新功能。

## 已完成的配置

### 1. 公钥已配置

公钥已添加到 `src-tauri/tauri.conf.json`：

```
pubkey: dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEE3MEM3QTI1NTk2OEMzQwpSV1E4akpaVm9zZHdDcVp4aFkzVTR1OHZIMXY5WDdJVXBzbFlqdjY0UWFncFI1MkxjcVdlYjZINgo=
```

### 2. 私钥位置

私钥已生成在 `.tauri/keys` 文件中，已添加到 `.gitignore`。

## 需要手动配置的 GitHub Secrets

请在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中添加以下 Secrets：

### TAURI_SIGNING_PRIVATE_KEY

私钥内容（复制以下完整内容）：

```
dW50cnVzdGVkIGNvbW1lbnQ6IHJzaWduIGVuY3J5cHRlZCBzZWNyZXQga2V5ClJXUlRZMEl5bzZ6a2I0MkY4cjBhQ3hlVEFHdnliQzVhTHdVemZnSk1Xc29EaVh6bTZOb0FBQkFBQUFBQUFBQUFBQUlBQUFBQVU5U09SY0RrZnd1YzFuM3o4cXYzeGJoc3dod3VuR2JvQlNGUk0xOEpLN25LdUlqQngva2IxS2tCYnB3ZWcvZFcyRkpXSVhtd3Z6dFdMR3kyckgrZ1hRL3Roc3BRWGMrcEZyblZGSktISzhWOVBhT3YyM1djTTgzQmNNdkNNV1VzZTRnZy9qK1JuL1E9Cg==
```

### TAURI_SIGNING_PRIVATE_KEY_PASSWORD

如果你在生成密钥时设置了密码，请填写该密码。如果没有设置密码，可以不添加此 Secret。

## 架构概述

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Releases                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ latest.json │  │ 安装包文件  │  │ 签名文件 (.sig)         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Rust 后端 (Tauri)                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ check_update()   -> 检查是否有新版本                      │   │
│  │ download_update() -> 后台静默下载                         │   │
│  │ install_and_restart() -> 安装并重启                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              │ Event                            │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ update://available  -> 发现新版本                         │   │
│  │ update://progress   -> 下载进度                           │   │
│  │ update://downloaded -> 下载完成                           │   │
│  │ update://error      -> 更新出错                           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Event
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     前端 (Next.js)                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ useUpdater Hook                                         │   │
│  │ - 监听事件                                               │   │
│  │ - 管理更新状态                                           │   │
│  │ - 触发安装重启                                           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 1. 生成签名密钥对

更新签名使用 Ed25519 算法，确保更新包的安全性。

### 生成密钥对

```bash
# 在项目根目录运行
npm run tauri signer generate -- -w .tauri/keys
```

这会生成：
- `.tauri/keys/tauri-signing.private.key` - 私钥（用于签名）
- `.tauri/keys/tauri-signing.public.key` - 公钥（用于验证）

### 重要提示

1. **私钥必须保密**，绝对不要提交到 Git 仓库
2. **公钥可以公开**，需要配置到 `tauri.conf.json` 中
3. 将私钥添加到 `.gitignore`:
   ```
   .tauri/keys/
   ```

## 2. 配置 GitHub Secrets

在 GitHub 仓库的 Settings -> Secrets and variables -> Actions 中添加：

| Secret 名称 | 说明 |
|------------|------|
| `TAURI_SIGNING_PRIVATE_KEY` | 私钥内容（整个文件内容） |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 生成密钥时设置的密码（如果有） |

### 获取私钥内容

```bash
cat .tauri/keys/tauri-signing.private.key
```

将输出内容完整复制到 GitHub Secret 中。

## 3. 配置公钥

将公钥内容配置到 `src-tauri/tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/CherryKingOne/workflows/releases/latest/download/latest.json"
      ],
      "pubkey": "你的公钥内容..."
    }
  }
}
```

### 获取公钥内容

```bash
cat .tauri/keys/tauri-signing.public.key
```

## 4. 发布流程

### 自动发布（推荐）

1. 更新 `src-tauri/tauri.conf.json` 中的版本号
2. 创建 Git 标签：
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. GitHub Actions 会自动构建并发布

### 手动发布

在 GitHub Actions 页面手动触发 `release.yml` 工作流，输入版本号。

## 5. latest.json 格式

GitHub Actions 会自动生成 `latest.json` 文件：

```json
{
  "version": "1.0.0",
  "notes": "WeiMeng v1.0.0",
  "pub_date": "2024-01-01T00:00:00Z",
  "platforms": {
    "darwin-x86_64": {
      "signature": "签名内容...",
      "url": "https://github.com/.../WeiMeng_1.0.0_x64.dmg"
    },
    "darwin-aarch64": {
      "signature": "签名内容...",
      "url": "https://github.com/.../WeiMeng_1.0.0_aarch64.dmg"
    },
    "windows-x86_64": {
      "signature": "签名内容...",
      "url": "https://github.com/.../WeiMeng_1.0.0_x64-setup.exe"
    },
    "linux-x86_64": {
      "signature": "签名内容...",
      "url": "https://github.com/.../WeiMeng_1.0.0_x64.AppImage"
    }
  }
}
```

## 6. 前端使用示例

```tsx
import { useUpdater } from '@/src/presentation/hooks/useUpdater';

function App() {
  const {
    updateInfo,
    status,
    progress,
    isDownloaded,
    checkForUpdate,
    startDownload,
    installAndRestart,
  } = useUpdater();

  // 检查更新
  const handleCheck = async () => {
    await checkForUpdate();
  };

  // 状态判断
  if (status === 'downloading') {
    return <div>下载中 {progress?.percent}%</div>;
  }

  if (isDownloaded) {
    return (
      <button onClick={installAndRestart}>
        重启更新 v{updateInfo?.version}
      </button>
    );
  }

  return <div>当前已是最新版本</div>;
}
```

## 7. 文件结构

```
src-tauri/
├── Cargo.toml              # 添加了 tauri-plugin-updater, tauri-plugin-process
├── tauri.conf.json         # 配置了 updater endpoints 和 pubkey
├── capabilities/
│   └── default.json        # 添加了 updater 权限
└── src/
    ├── commands/
    │   ├── mod.rs
    │   └── updater.rs      # 更新命令（check_update, download_update, install_and_restart）
    └── lib.rs              # 注册了 updater 插件和命令

src/presentation/hooks/
└── useUpdater.ts           # 前端更新 Hook

.github/workflows/
└── release.yml             # 发布工作流（签名、构建、上传）
```

## 8. 测试更新

### 本地测试

由于更新检查需要从 HTTPS URL 获取 `latest.json`，本地开发时无法测试完整流程。
建议在测试环境发布一个低版本，然后发布新版本进行测试。

### 调试日志

在浏览器控制台中查看更新日志：
- `[useUpdater]` - 前端 Hook 日志
- Rust 后端日志会输出到 Tauri 日志文件

## 9. 常见问题

### Q: 为什么本地开发时看不到更新提示？

A: 更新检查需要从 GitHub Releases 获取 `latest.json`，本地开发环境无法访问。需要发布一个正式版本后才能测试。

### Q: 如何强制触发更新检查？

A: 调用 `checkForUpdate()` 方法即可手动检查更新。

### Q: 如何禁用自动下载？

A: 移除 `useEffect` 中的 `startDownload()` 调用，改为用户手动触发。

### Q: Windows 上更新失败怎么办？

A: Windows 更新需要管理员权限，确保应用以管理员身份运行，或者使用 NSIS 安装包格式。
