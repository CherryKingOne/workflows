import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Project } from '../../domain/project/entities/Project';
import { ProjectId, ProjectMeta } from '../../domain/project/valueObjects';

/**
 * useProjects Hook
 * 
 * 作用 (Purpose):
 * 负责管理项目列表状态，提供项目的增删改查操作接口。
 * 
 * 领域驱动设计 (DDD) 与 Tauri 后端集成说明:
 * 此 Hook 现已完全对接 Rust 后端提供的 IPC 接口 (Tauri Commands)。
 * 因为后端的 Application 层已经处理了 ID 的生成和业务数据的持久化（基于 SQLite），
 * 前端在这里直接调用对应的 invoke 命令，并将后端的 DTO 转换为前端的领域模型。
 *
 * [Update 2026-04-02] - 从 LocalStorage 迁移为真正的 Tauri + SQLite 后端调用。
 */
/**
 * 后端返回的项目数据传输对象 (DTO)
 */
interface ProjectDto {
  id: { value: string };
  meta: {
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
  };
}

export function useProjects() {
  // 状态：当前所有的项目列表
  const [projects, setProjects] = useState<Project[]>([]);
  // 状态：页面是否处于加载中
  const [isLoading, setIsLoading] = useState(true);
  // 状态：是否发生异常错误
  const [error, setError] = useState<Error | null>(null);

  /**
   * 辅助方法：将后端返回的原始 JSON 数据转换为前端 Domain 的 Project 实体
   */
  const mapDataToEntity = (p: ProjectDto): Project => {
    return new Project(
      new ProjectId(p.id.value),
      new ProjectMeta(
        p.meta.name,
        p.meta.description,
        new Date(p.meta.createdAt),
        new Date(p.meta.updatedAt)
      )
    );
  };

  /**
   * 刷新项目列表
   * 调用后端的 `get_projects` 函数
   */
  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await invoke<ProjectDto[]>('get_projects');
      const entities = data.map(mapDataToEntity);
      setProjects(entities);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 组件挂载时自动拉取数据
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  /**
   * 创建项目
   * 调用后端的 `create_project` 函数，ID 由后端生成。
   * @param name 项目名称
   * @param description 项目描述
   * @returns 创建成功后的 Project 实体
   */
  const createProject = async (name: string, description: string) => {
    try {
      const data = await invoke<ProjectDto>('create_project', { name, description });
      const newProject = mapDataToEntity(data);
      setProjects(prev => [newProject, ...prev]);
      return newProject;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      throw e;
    }
  };

  /**
   * 更新项目
   * 调用后端的 `update_project` 函数
   * @param id 项目ID
   * @param name 新项目名称
   * @param description 新项目描述
   * @returns 更新成功后的 Project 实体
   */
  const updateProject = async (id: string, name: string, description: string) => {
    try {
      const data = await invoke<ProjectDto>('update_project', { id, name, description });
      const updatedProject = mapDataToEntity(data);
      setProjects(prev => prev.map(p => p.id.value === id ? updatedProject : p));
      return updatedProject;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      throw e;
    }
  };

  /**
   * 删除项目
   * 调用后端的 `delete_project` 函数
   * @param id 项目ID
   */
  const deleteProject = async (id: string) => {
    try {
      await invoke('delete_project', { id });
      setProjects(prev => prev.filter(p => p.id.value !== id));
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      throw e;
    }
  };

  return {
    projects,
    isLoading,
    error,
    createProject,
    updateProject,
    deleteProject,
    refresh: fetchProjects
  };
}
