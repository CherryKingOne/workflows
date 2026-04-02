"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProjects } from '../../../../../src/presentation/hooks/useProjects';
import { ProjectCard } from './ProjectCard';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { Input } from '../../../components/common/Input';
import { Dropdown } from '../../../components/common/Dropdown';
import { Project } from '../../../../domain/project/entities/Project';

/**
 * 项目列表页面主组件 (ProjectList)
 * 
 * 作用 (Purpose):
 * 负责展示和管理所有项目的网格列表，以及创建、编辑、删除等弹出交互。
 * 这个组件完全由状态 (State) 驱动，遵循单向数据流。
 * 
 * 修改纪律 (Modification Discipline):
 * - 此处主要处理 UI 的展示和状态切换，业务逻辑都在 `useProjects` 这个 Hook 里面。
 * - 如需添加新功能，请务必保证弹窗、事件、表单的控制相互独立，不要直接在这里写业务/网络请求代码。
 * 
 * [Update 2026-04-02] - 初始版本，设计完成黑色深邃主题 UI 与弹窗逻辑。
 */
export function ProjectList() {
  const router = useRouter();
  // [Hooks 调用] 从 useProjects hook 中获取项目列表数据以及增删改查的方法
  const { projects, isLoading, error, createProject, updateProject, deleteProject } = useProjects();
  
  // [状态] 控制下拉列表的当前选中排序值
  const [sortValue, setSortValue] = useState('updated_at');
  
  // ==========================================
  // [状态组] 新建项目 (Create Project)
  // ==========================================
  // 控制新建项目弹窗是否可见
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // ==========================================
  // [状态组] 编辑项目 (Edit Project)
  // ==========================================
  // 控制编辑弹窗是否可见
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // 当前正在被编辑的项目实体，用于回显和提交时使用其 ID
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDesc, setEditProjectDesc] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // ==========================================
  // [状态组] 删除项目 (Delete Project)
  // ==========================================
  // 控制删除确认弹窗是否可见
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  // 当前等待被删除的项目实体，用于显示警告名称
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 排序下拉框配置项
  const sortOptions = [
    { value: 'updated_at', label: '按修改时间' },
    { value: 'created_at', label: '按创建时间' },
    { value: 'name', label: '按名称' }
  ];

  // ==========================================
  // [事件处理] 基础 Loading 与错误展示
  // ==========================================
  if (isLoading) return <div className="p-8 text-center text-zinc-500">加载中...</div>;
  if (error) return <div className="p-8 text-center text-red-500">加载失败: {error.message}</div>;

  // ==========================================
  // [事件处理] 提交：创建新项目
  // 步骤：(1) 验证名称不为空 (2)开启Loading状态 (3)调用Hook函数保存 (4)清空表单并关闭弹窗
  // ==========================================
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    
    setIsCreating(true);
    try {
      await createProject(newProjectName.trim(), newProjectDesc.trim() || '新项目描述');
      setIsCreateModalOpen(false);
      setNewProjectName('');
      setNewProjectDesc('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  // ==========================================
  // [事件处理] 准备：打开编辑弹窗并回显数据
  // ==========================================
  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setEditProjectName(project.meta.name);
    setEditProjectDesc(project.meta.description);
    setIsEditModalOpen(true);
  };

  // ==========================================
  // [事件处理] 提交：编辑并保存项目
  // ==========================================
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !editProjectName.trim()) return;
    
    setIsEditing(true);
    try {
      await updateProject(editingProject.id.value, editProjectName.trim(), editProjectDesc.trim());
      setIsEditModalOpen(false);
      setEditingProject(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsEditing(false);
    }
  };

  // ==========================================
  // [事件处理] 准备：打开删除警告弹窗
  // ==========================================
  const openDeleteModal = (project: Project) => {
    setDeletingProject(project);
    setIsDeleteModalOpen(true);
  };

  // ==========================================
  // [事件处理] 提交：确认永久删除
  // ==========================================
  const handleDeleteSubmit = async () => {
    if (!deletingProject) return;
    
    setIsDeleting(true);
    try {
      await deleteProject(deletingProject.id.value);
      setIsDeleteModalOpen(false);
      setDeletingProject(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  // ==========================================
  // [UI 渲染区域]
  // ==========================================
  return (
    <div className="min-h-full w-full flex flex-col bg-black">
      <main className="flex-1 overflow-auto ui-scrollbar p-8">
        <div className="max-w-6xl mx-auto">
          
          {/* 顶部 Header：大标题与操作区 */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-white">项目</h1>
            <div className="flex items-center gap-4">
              <Dropdown 
                options={sortOptions} 
                value={sortValue} 
                onChange={setSortValue}
                className="w-40"
              />
              <Button onClick={() => setIsCreateModalOpen(true)} className="h-9 px-5 text-sm gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"/>
                  <path d="M12 5v14"/>
                </svg>
                新建项目
              </Button>
            </div>
          </div>

          {/* 项目网格列表 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* 动态渲染项目数据卡片 */}
            {projects.map(project => (
              <ProjectCard 
                key={project.id.value}
                project={project}
                onClick={() => router.push(`/canvas/${project.id.value}`)}
                onEdit={() => openEditModal(project)}
                onDelete={() => openDeleteModal(project)}
              />
            ))}
            
            {/* 固定的虚线占位：新建项目卡片 */}
            <div 
              className="bg-[#0a0a0a] border border-dashed border-white/10 rounded-xl p-5 cursor-pointer flex flex-col items-center justify-center min-h-[140px] hover:border-white/30 hover:bg-white/5 transition-all duration-300 group"
              onClick={() => setIsCreateModalOpen(true)}
              tabIndex={0}
              role="button"
              aria-label="新建项目"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsCreateModalOpen(true);
                }
              }}
            >
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 group-hover:text-white transition-colors duration-300">
                  <path d="M5 12h14"/>
                  <path d="M12 5v14"/>
                </svg>
              </div>
              <span className="text-sm font-medium text-zinc-500 group-hover:text-zinc-300 transition-colors duration-300">新建项目</span>
            </div>
          </div>
        </div>
      </main>

      {/* ========================================== */}
      {/* 弹窗渲染区域 (Modals)                        */}
      {/* ========================================== */}

      {/* 1. 新建项目弹窗 */}
      <Modal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)}
        title="新建项目"
      >
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-5">
          <Input 
            label="项目名称" 
            placeholder="例如：我的第一个项目"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            autoFocus
            required
          />
          <Input 
            label="项目描述（可选）" 
            placeholder="简要描述一下这个项目"
            value={newProjectDesc}
            onChange={(e) => setNewProjectDesc(e.target.value)}
          />
          <div className="flex justify-end gap-3 mt-4">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2"
            >
              取消
            </Button>
            <Button 
              type="submit" 
              className="px-4 py-2"
              disabled={isCreating || !newProjectName.trim()}
            >
              {isCreating ? '创建中...' : '确认创建'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 2. 编辑项目弹窗 */}
      <Modal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)}
        title="编辑项目"
      >
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-5">
          <Input 
            label="项目名称" 
            placeholder="项目名称"
            value={editProjectName}
            onChange={(e) => setEditProjectName(e.target.value)}
            autoFocus
            required
          />
          <Input 
            label="项目描述（可选）" 
            placeholder="简要描述一下这个项目"
            value={editProjectDesc}
            onChange={(e) => setEditProjectDesc(e.target.value)}
          />
          <div className="flex justify-end gap-3 mt-4">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2"
            >
              取消
            </Button>
            <Button 
              type="submit" 
              className="px-4 py-2"
              disabled={isEditing || !editProjectName.trim()}
            >
              {isEditing ? '保存中...' : '保存更改'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 3. 删除确认警告弹窗 */}
      <Modal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)}
        title="删除项目"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-zinc-400">
            确定要删除项目 <span className="font-bold text-white">&quot;{deletingProject?.meta.name}&quot;</span> 吗？
          </p>
          <p className="text-sm text-red-500 font-medium">
            此操作不可撤销，项目中包含的所有节点将被永久删除。
          </p>
          
          <div className="flex justify-end gap-3 mt-4">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2"
            >
              取消
            </Button>
            <Button 
              type="button" 
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white"
              onClick={handleDeleteSubmit}
              disabled={isDeleting}
            >
              {isDeleting ? '删除中...' : '确认删除'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
