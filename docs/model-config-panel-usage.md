# 模型配置可视化面板使用指南

## 概述

模型配置可视化面板用于在前端展示和管理 AI 模型的配置信息，包括 API Key、Base URL 等。

## 组件结构

```
ModelConfigPanel (面板容器)
  └── ModelConfigCard (单个配置卡片) × N
```

## 核心组件

### 1. ModelConfigPanel

面板容器组件，负责加载和展示配置列表。

**Props:**
- `modelType?: 'image' | 'chat'` - 模型类型过滤
- `title?: string` - 面板标题

**功能:**
- 自动初始化配置（从注册表同步到数据库）
- 加载配置列表
- 处理加载状态和错误
- 提供刷新功能

### 2. ModelConfigCard

单个配置卡片组件，负责展示和编辑单个模型配置。

**Props:**
- `config: ModelConfig` - 模型配置数据
- `onUpdate: (modelId, data) => Promise<void>` - 更新回调
- `onTest?: (config) => Promise<TestResult>` - 测试连接回调

**功能:**
- 展示模型信息（名称、类型、状态）
- 编辑配置（Base URL、API Key）
- 测试连接
- API Key 显示/隐藏切换
- 启用/禁用切换

## 在 ApiSettingsModal 中使用

### 方式一：直接替换内容（推荐）

```tsx
import { ModelConfigPanel } from '@/src/presentation/components/ModelConfigPanel';

export function ApiSettingsModal({ isOpen, onClose }: ApiSettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-900">API 设置</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* 图像模型配置 */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">图像模型</h3>
            <ModelConfigPanel modelType="image" />
          </div>

          {/* 对话模型配置 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">对话模型</h3>
            <ModelConfigPanel modelType="chat" />
          </div>
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 方式二：使用 Tab 切换

```tsx
import { useState } from 'react';
import { ModelConfigPanel } from '@/src/presentation/components/ModelConfigPanel';

export function ApiSettingsModal({ isOpen, onClose }: ApiSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'image' | 'chat'>('image');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-900">API 设置</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('image')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'image'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            图像模型
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'chat'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            对话模型
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <ModelConfigPanel modelType={activeTab} />
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
```

## 数据流

```
用户操作
  ↓
ModelConfigCard (编辑/测试)
  ↓
useModelConfig Hook
  ↓
ModelConfigApi (Tauri API)
  ↓
Tauri Commands (Rust)
  ↓
SQLite Database
```

## 功能特性

### ✅ 已实现

- 加载配置列表（从 SQLite）
- 展示配置信息
- 编辑配置（Base URL、API Key、启用状态）
- API Key 显示/隐藏
- 保存配置到数据库
- 加载状态和错误处理
- 自动初始化（注册表同步）

### 🚧 待实现

- 真实的连接测试（目前是模拟）
- 配置验证（URL 格式、API Key 格式）
- 批量操作
- 配置导入/导出

## 注意事项

1. **不支持创建/删除**：模型配置只能通过代码注册表管理，不支持通过界面创建或删除
2. **自动初始化**：首次打开面板时会自动将注册表中的模型同步到数据库
3. **API Key 安全**：生产环境建议在后端加密存储
4. **环境变量**：默认配置从 `NEXT_PUBLIC_*` 环境变量读取

## 移除旧的模拟数据

如果你的 `ApiSettingsModal` 中还在使用 `useApiConfigs` 的模拟数据，请按以下步骤迁移：

1. 移除 `useApiConfigs` 的调用
2. 导入 `ModelConfigPanel` 组件
3. 替换内容区域为 `<ModelConfigPanel />`
4. 删除旧的配置卡片渲染逻辑

## 示例截图说明

配置卡片包含以下元素：
- 模型名称和状态标签（已启用/已禁用、图像/对话）
- 测试连接按钮
- 编辑按钮
- 配置字段（Model ID、Base URL、API Key）
- API Key 显示/隐藏切换
- 保存/取消按钮（编辑模式）
- 测试结果提示（成功/失败）
