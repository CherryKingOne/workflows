# 快速发布指南

## 当前构建产物

构建已成功完成!产物位于:

- **DMG 安装包**: `src-tauri/target/release/bundle/dmg/WeiMeng_0.0.1_x64.dmg` (6.7MB)
- **应用程序**: `src-tauri/target/release/bundle/macos/WeiMeng.app`

## 立即发布到 GitHub Releases

### 选项 1: 快速发布 (推荐)

```bash
# 1. 提交当前的 GitHub Actions 配置
git add .github/workflows/release.yml CHANGELOG.md scripts/ docs/
git commit -m "feat: add automated release workflow"

# 2. 推送到 GitHub
git push origin main

# 3. 创建第一个发布 tag
git tag -a v0.0.1 -m "First release - WeiMeng v0.0.1"
git push origin v0.0.1
```

### 选项 2: 手动上传 DMG

如果不想使用自动化流程,可以手动上传:

1. 访问: https://github.com/CherryKingOne/workflows/releases
2. 点击 "Draft a new release"
3. 点击 "Choose a tag" -> 输入 `v0.0.1` -> Create new tag
4. 填写 Release title: `WeiMeng v0.0.1`
5. 填写 Release notes (可复制 CHANGELOG.md 内容)
6. 上传文件: `src-tauri/target/release/bundle/dmg/WeiMeng_0.0.1_x64.dmg`
7. 点击 "Publish release"

## 自动化发布流程 (已配置)

GitHub Actions 工作流已创建,以后只需:

```bash
# 修复版本 (0.0.1 -> 0.0.2)
./scripts/release.sh patch

# 次版本 (0.0.1 -> 0.1.0)
./scripts/release.sh minor

# 主版本 (0.0.1 -> 1.0.0)
./scripts/release.sh major
```

## GitHub Actions 会自动:

1. 构建 macOS 应用 (Intel + Apple Silicon)
2. 创建 DMG 安装包
3. 创建 GitHub Release
4. 上传构建产物

## 查看构建进度

推送 tag 后,访问:
https://github.com/CherryKingOne/workflows/actions

## 下载地址

发布后,用户可以从这里下载:
https://github.com/CherryKingOne/workflows/releases

## 下一步

建议先推送 GitHub Actions 配置,然后再创建 tag 触发自动构建:

```bash
# 第一步: 推送配置
git add .
git commit -m "feat: add automated release workflow"
git push origin main

# 第二步: 等待确认配置已推送成功

# 第三步: 创建 release tag
git tag -a v0.0.1 -m "First release"
git push origin v0.0.1
```

这样 GitHub Actions 会自动构建并创建 Release!
