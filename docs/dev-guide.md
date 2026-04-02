# workflow桌面应用开发指南

## 技术栈

- **前端**: Next.js 16 + React 19 + TailwindCSS 4
- **后端**: Rust + Tauri 2.x
- **通信**: IPC (前端直接调用 Rust 函数，无需 HTTP)

## 目录结构

```
workflow/
├── app/                    # Next.js 前端页面
├── src/
│   ├── components/         # React 组件
│   ├── lib/               # 工具函数
│   └── ...
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── main.rs        # Tauri 入口
│   │   └── lib.rs         # Rust 业务逻辑
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── ...
```

## 初始化步骤

### 1. 安装 Tauri CLI

```bash
npm install -D @tauri-apps/cli@latest
```

### 2. 初始化 Tauri

```bash
npx tauri init --app-name "workflow" --window-title "workflow" --dev-url "http://localhost:3000" --before-dev-command "npm run dev" --before-build-command "npm run build"
```

### 3. 添加 Tauri API 依赖

```bash
npm install @tauri-apps/api@latest
```

### 4. 在 package.json 添加脚本

```json
{
  "scripts": {
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  }
}
```

## 前端调用 Rust 函数

### Rust 端：定义命令

```rust
// src-tauri/src/lib.rs
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}
```

### 前端端：调用命令

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke<string>('greet', { name: 'World' });
console.log(result); // "Hello, World!"
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run tauri:dev` | 开发模式运行桌面应用 |
| `npm run tauri:build` | 构建生产版本 |

## 注意事项

- Tauri 2.x 使用 `invoke` 而非旧版的 `remote`
- 前端运行在 `http://localhost:3000`，Tauri 通过 WebView 加载
- Rust 代码修改后会自动重新加载