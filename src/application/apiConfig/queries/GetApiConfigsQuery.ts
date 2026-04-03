/**
 * ============================================================================
 * Get API Configs Query
 * ============================================================================
 * 
 * 【应用层 - 查询用例 / Application Layer - Query】
 * 
 * 【职责说明】
 * 本文件实现了"获取 API 配置列表"的查询用例。
 * 
 * 【查询用例的作用】
 * - 封装一个完整的业务查询流程
 * - 协调领域层和基础设施层完成数据获取
 * - 对展示层隐藏复杂的组装逻辑
 * 
 * 【设计意图】
 * - 一个查询类对应一个明确的业务问题
 * - 查询类不应修改任何领域对象状态（仅读取）
 * - 查询类应返回展示层所需的数据格式
 * 
 * 【新手须知】
 * - 查询类通过构造函数接收依赖（依赖注入）
 * - 查询类的 execute 方法是唯一入口
 * - 查询结果应在应用层完成 DTO 到实体的转换
 * 
 * 【后续扩展预留】
 * - 可能需要添加分页参数（offset/limit）
 * - 可能需要添加排序参数
 * - 可能需要添加过滤条件（按类型、按启用状态）
 */

import { IApiConfigRepository } from '../../../domain/apiConfig/repositories/IApiConfigRepository';
import { ApiConfig } from '../../../domain/apiConfig/entities/ApiConfig';
import { ApiType } from '../../../domain/apiConfig/valueObjects';

/**
 * 获取 API 配置列表查询的输入参数
 * 
 * 【字段说明】
 * - filterType: 可选，按类型过滤（Chat/Image/Video）
 *   - 如果不传或传 null，返回所有类型
 *   - 如果传入具体类型，仅返回该类型配置
 */
export interface GetApiConfigsQueryInput {
  filterType?: ApiType | null;
}

/**
 * 获取 API 配置列表查询的输出结果
 * 
 * 【字段说明】
 * - configs: 配置实体数组
 * - totalCount: 总数量（用于 UI 展示徽章数字）
 * - groupedByType: 按类型分组的配置（用于 Tab 切换展示）
 */
export interface GetApiConfigsQueryOutput {
  configs: ApiConfig[];
  totalCount: number;
  groupedByType: {
    chat: ApiConfig[];
    image: ApiConfig[];
    video: ApiConfig[];
  };
}

/**
 * 获取 API 配置列表查询类
 * 
 * 【业务语义】
 * 获取系统中所有的 API 配置，支持按类型过滤。
 * 
 * 【使用场景】
 * - 用户打开 API 设置弹窗时调用
 * - 用户切换 Tab 时调用
 * - 页面加载时初始化配置列表
 * 
 * 【后续对接说明】
 * 此类将由 Tauri 命令或直接由前端 Hook 调用。
 * 调用方式：
 *   const query = new GetApiConfigsQuery(repository);
 *   const result = await query.execute({ filterType: ApiType.CHAT });
 */
export class GetApiConfigsQuery {
  /**
   * 构造函数
   * 
   * @param apiConfigRepo - API 配置仓库实现（依赖注入）
   */
  constructor(private apiConfigRepo: IApiConfigRepository) {}

  /**
   * 执行查询
   * 
   * 【业务流程】
   * 1. 根据 filterType 决定查询全部还是按类型查询
   * 2. 从仓库获取配置数据
   * 3. 按类型分组（用于 UI Tab 展示）
   * 4. 返回格式化结果
   * 
   * 【后续对接说明】
   * - 此方法将被 Tauri 命令或 Hook 调用
   * - 返回结果可直接用于 UI 展示
   * - 如果仓库调用失败，异常应向上抛出
   * 
   * @param input - 查询输入参数（可选）
   * @returns Promise<GetApiConfigsQueryOutput> - 查询结果
   * @throws 如果仓库操作失败，抛出原始错误
   */
  async execute(input?: GetApiConfigsQueryInput): Promise<GetApiConfigsQueryOutput> {
    let configs: ApiConfig[];

    // 根据过滤条件查询
    if (input?.filterType) {
      configs = await this.apiConfigRepo.findByType(input.filterType);
    } else {
      configs = await this.apiConfigRepo.findAll();
    }

    // 按类型分组（用于 UI Tab 展示）
    const groupedByType = {
      chat: configs.filter((c) => c.apiType === ApiType.CHAT),
      image: configs.filter((c) => c.apiType === ApiType.IMAGE),
      video: configs.filter((c) => c.apiType === ApiType.VIDEO),
    };

    return {
      configs,
      totalCount: configs.length,
      groupedByType,
    };
  }
}
