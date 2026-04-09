# 发布流程指南

本文档说明如何将 WeiMeng 应用发布到 GitHub Releases。

## 发布方式

### 方式一: 使用发布脚本 (推荐)

```bash
# 修复版本 (0.0.1 -> 0.0.2)
./scripts/release.sh patch

# 次版本 (0.0.1 -> 0.1.0)
./scripts/release.sh minor

# 主版本 (0.0.1 -> 1.0.0)
./scripts/release.sh major

# 带发布说明
./scripts/release.sh patch "修复了关键 bug"
```

脚本会自动:
1. 更新 `package.json` 和 `tauri.conf.json` 中的版本号
2. 创建 git commit
3. 创建 git tag
4. 推送到 GitHub

### 方式二: 手动发布

1. 更新版本号:
```bash
# 更新 package.json
npm version patch  # 或 minor, major

# 更新 tauri.conf.json
# 手动编辑 src-tauri/tauri.conf.json 中的 version 字段
```

2. 提交并打标签:
```bash
git add package.json src-tauri/tauri.conf.json
git commit -m "chore: bump version to x.x.x"
git tag -a vx.x.x -m "Release version x.x.x"
git push origin main
git push origin vx.x.x
```

### 方式三: GitHub Actions 手动触发

1. 进入 GitHub 仓库页面
2. 点击 "Actions" 标签
3. 选择 "Build and Release" 工作流
4. 点击 "Run workflow" 按钮
5. 输入版本号并运行

## GitHub Actions 自动构建

当推送 tag (格式为 `v*.*.*`) 时,GitHub Actions 会自动:

1. 在 macOS 上构建应用
2. 为 Intel 和 Apple Silicon 分别构建 dmg
3. 创建 GitHub Release
4. 上传 dmg 文件到 Release

## 构建产物

构建完成后,Release 页面会包含:

- `WeiMeng_x.x.x_x64.dmg` - Intel Mac 安装包
- `WeiMeng_x.x.x_aarch64.dmg` - Apple Silicon Mac 安装包

## 查看 Release

构建完成后,可以在这里下载:

```
https://github.com/YOUR_USERNAME/YOUR_REPO/releases
```

## 更新 CHANGELOG

每次发布前,请更新 `CHANGELOG.md`:

```markdown
## [x.x.x] - YYYY-MM-DD

### Added
- 新功能

### Changed
- 变更内容

### Fixed
- 修复的问题

### Removed
- 移除的功能
```

## 版本号规则

遵循 [Semantic Versioning](https://semver.org/):

- **主版本 (Major)**: 不兼容的 API 变更
- **次版本 (Minor)**: 向后兼容的功能新增
- **修订版本 (Patch)**: 向后兼容的问题修复

示例:
- `1.0.0` -> `1.0.1` (Patch): Bug 修复
- `1.0.0` -> `1.1.0` (Minor): 新增功能
- `1.0.0` -> `2.0.0` (Major): 重大变更

## 故障排查

### 构建失败

1. 检查 GitHub Actions 日志
2. 确认所有依赖已正确安装
3. 验证 `tauri.conf.json` 配置

### Release 未创建

1. 确认 tag 格式正确 (`v1.0.0`)
2. 检查 GitHub Token 权限
3. 查看 Actions 执行状态

### DMG 文件损坏

macOS 可能阻止未签名应用,解决方法:

```bash
# 方法一: 允许特定应用
xattr -cr /path/to/WeiMeng.app

# 方法二: 系统偏好设置
# 安全性与隐私 -> 通用 -> 仍要打开
```

## 代码签名 (可选)

为了更好的用户体验,建议添加代码签名:

1. 获取 Apple Developer 证书
2. 配置环境变量:
```bash
export APPLE_CERTIFICATE=<base64-encoded-certificate>
export APPLE_CERTIFICATE_PASSWORD=<password>
export APPLE_SIGNING_IDENTITY=<identity>
export APPLE_ID=<apple-id>
export APPLE_PASSWORD=<app-specific-password>
```

3. 更新 GitHub Actions 工作流添加签名步骤

## 持续集成

- GitHub Actions 会自动运行测试
- 只有在所有检查通过后才会创建 Release
- 支持预发布版本 (版本号包含 `-`,如 `1.0.0-beta.1`)

## 回滚发布

如果发现问题需要回滚:

```bash
# 删除远程 tag
git push --delete origin vx.x.x

# 删除本地 tag
git tag -d vx.x.x

# 删除 GitHub Release (通过网页界面)

# 修复问题后重新发布
```
