"use client";

import { use } from 'react';
import { CanvasBoard } from '../../../../src/presentation/pages/canvas/components/CanvasBoard';
import { useProjectDetail } from '../../../../src/presentation/hooks/useProjectDetail';

/**
 * Canvas 路由页面入口
 *
 * 这个文件是前端路由层的“最外层入口”，对应访问地址：
 * `/canvas/[projectId]`
 *
 * 给后续交接同学，尤其是刚接触项目的新手，先记住这一点：
 * 1. 这里是“路由页面”，主要职责是接住 URL 参数、拉取当前项目、处理页面级异常，然后把数据交给真正的画布页面组件。
 * 2. 这里不是具体视觉设计的大本营，不应该把弹窗、工作流卡片、节点面板、右侧属性区等所有 UI 细节都堆在这里。
 * 3. 如果后续新增页面能力，例如：
 *    - 新增弹窗页面
 *    - 新增工作流卡片展示页面
 *    - 新增节点创建面板
 *    - 新增画布右侧属性编辑面板
 *    - 新增导出页、预览页、对比页
 *    都应该优先拆到各自独立的页面模块 / 组件模块 / 组合函数中，再由当前路由页面进行“组装调用”。
 *
 * 为什么这样做：
 * - 这是为了遵循 DDD 思路下的分层职责。
 * - `app/(routes)` 更像路由接入层，只负责页面进入点。
 * - `src/presentation` 负责展示层组件和交互编排。
 * - `src/application` 负责用例、命令、查询。
 * - `src/domain` 负责核心业务对象和规则。
 *
 * 简单理解：
 * - 路由层：决定“进入哪个页面”
 * - 展示层：决定“页面怎么展示、怎么交互”
 * - 应用层：决定“要执行什么业务动作”
 * - 领域层：决定“业务规则本身是什么”
 *
 * 后续扩展约定，务必遵守：
 * - 不要把所有新增 UI 直接继续堆进当前文件。
 * - 先设计独立页面或独立组件，再由这里调用。
 * - 当前文件保持“薄路由页”定位，避免后期失控。
 *
 * 推荐扩展示例：
 * - `src/presentation/pages/canvas/components/modals/StorageModal.tsx`
 * - `src/presentation/pages/canvas/components/modals/ApiSettingsModal.tsx`
 * - `src/presentation/pages/canvas/components/cards/WorkflowCard.tsx`
 * - `src/presentation/pages/canvas/components/panels/NodeInspectorPanel.tsx`
 * - `src/presentation/pages/canvas/composables/useCanvasInteractions.ts`
 *
 * 这份注释的目标不是炫技，而是让第一次接手项目的人，
 * 能在 1 到 3 分钟内快速知道“这个文件能做什么、不能做什么、以后应该往哪里扩”。
 */
export default function CanvasPage({ params }: { params: Promise<{ projectId: string }> }) {
  /**
   * 这里特别注意：
   * 当前项目使用的不是旧版 Next.js 习惯。
   * 按项目内置文档，这一版 App Router 中 `params` 是 Promise。
   *
   * 所以这里不能按老写法直接拿 `params.projectId`，
   * 而是要先用 React 的 `use(params)` 解包。
   *
   * 如果后续有新同学看到这里觉得“为什么不直接解构参数”，
   * 请先去看：
   * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`
   *
   * 这是项目当前 Next.js 版本的真实文档依据，不能凭旧经验乱改。
   */
  const resolvedParams = use(params);

  /**
   * 页面级数据获取入口：
   * 根据路由里的 `projectId` 读取当前项目详情。
   *
   * 这里依然只做“页面接线”，不做复杂业务判断。
   * 复杂业务逻辑如果未来增多，应继续下沉到：
   * - presentation hooks
   * - application queries / commands
   * - domain rules
   */
  const { project, error } = useProjectDetail(resolvedParams.projectId);

  /**
   * 页面级错误态：
   * 如果项目数据加载失败，当前路由页直接给出完整错误占位。
   *
   * 这是“页面壳层错误”，不是画布内部某一个小组件的局部错误。
   * 所以后续如果加入更细粒度的错误处理，也应该分层：
   * - 路由页处理整页无法进入的问题
   * - 组件内部处理局部模块异常的问题
   */
  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <h2 className="text-2xl mb-2 text-red-500">无法加载项目</h2>
          <p className="text-zinc-500">{error.message}</p>
        </div>
      </div>
    );
  }

  /**
   * 主渲染入口：
   * 当前路由页只负责把“项目数据”交给 `CanvasBoard`。
   *
   * 未来如果新增以下能力，也不要在这里直接展开完整 UI：
   * - 弹窗具体内容
   * - 工作流卡片具体样式
   * - 画布节点的结构实现
   * - 右侧详情栏
   * - 上下文菜单的复杂逻辑
   *
   * 正确做法是：
   * 1. 在 presentation 层建立独立模块
   * 2. 让 `CanvasBoard` 或其它组合组件去调用
   * 3. 当前文件继续保持为“页面入口 + 数据接线 + 页面级兜底”
   */
  return (
    <main className="h-screen w-screen overflow-hidden bg-black text-white">
      <CanvasBoard project={project} />
    </main>
  );
}
