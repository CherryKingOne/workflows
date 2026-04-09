import { CanvasClient } from './CanvasClient';

/**
 * Canvas 路由页面入口
 *
 * 这个文件是前端路由层的"最外层入口"，对应访问地址：
 * `/canvas/[projectId]`
 *
 * 给后续交接同学，尤其是刚接触项目的新手，先记住这一点：
 * 1. 这里是"路由页面"，主要职责是接住 URL 参数、拉取当前项目、处理页面级异常，然后把数据交给真正的画布页面组件。
 * 2. 这里不是具体视觉设计的大本营，不应该把弹窗、工作流卡片、节点面板、右侧属性区等所有 UI 细节都堆在这里。
 * 3. 如果后续新增页面能力，例如：
 *    - 新增弹窗页面
 *    - 新增工作流卡片展示页面
 *    - 新增节点创建面板
 *    - 新增画布右侧属性编辑面板
 *    - 新增导出页、预览页、对比页
 *    都应该优先拆到各自独立的页面模块 / 组件模块 / 组合函数中，再由当前路由页面进行"组装调用"。
 *
 * 为什么这样做：
 * - 这是为了遵循 DDD 思路下的分层职责。
 * - `app/(routes)` 更像路由接入层，只负责页面进入点。
 * - `src/presentation` 负责展示层组件和交互编排。
 * - `src/application` 负责用例、命令、查询。
 * - `src/domain` 负责核心业务对象和规则。
 *
 * 简单理解：
 * - 路由层：决定"进入哪个页面"
 * - 展示层：决定"页面怎么展示、怎么交互"
 * - 应用层：决定"要执行什么业务动作"
 * - 领域层：决定"业务规则本身是什么"
 *
 * 后续扩展约定，务必遵守：
 * - 不要把所有新增 UI 直接继续堆进当前文件。
 * - 先设计独立页面或独立组件，再由这里调用。
 * - 当前文件保持"薄路由页"定位，避免后期失控。
 *
 * 推荐扩展示例：
 * - `src/presentation/pages/canvas/components/modals/StorageModal.tsx`
 * - `src/presentation/pages/canvas/components/modals/ApiSettingsModal.tsx`
 * - `src/presentation/pages/canvas/components/cards/WorkflowCard.tsx`
 * - `src/presentation/pages/canvas/components/panels/NodeInspectorPanel.tsx`
 * - `src/presentation/pages/canvas/composables/useCanvasInteractions.ts`
 *
 * 这份注释的目标不是炫技，而是让第一次接手项目的人，
 * 能在 1 到 3 分钟内快速知道"这个文件能做什么、不能做什么、以后应该往哪里扩"。
 */

/**
 * 静态参数生成
 *
 * 由于 Tauri 应用使用静态导出 (output: 'export')，
 * 而动态路由 [projectId] 无法在构建时预知所有可能的 ID，
 * 所以这里返回一个占位符让构建能够通过。
 *
 * 实际的 projectId 会在客户端通过 URL 解析并动态加载数据。
 * Next.js 会自动为未匹配的路由使用这个模板页面。
 */
export async function generateStaticParams() {
  // 返回一个占位符，让构建能够生成 canvas/[projectId] 的静态模板
  // 客户端会从实际 URL 中获取真实的 projectId
  return [{ projectId: 'placeholder' }];
}

/**
 * 页面组件
 *
 * 使用服务端组件包装客户端组件，以便支持静态导出
 */
export default function CanvasPage({ params }: { params: Promise<{ projectId: string }> }) {
  return <CanvasClient params={params} />;
}
