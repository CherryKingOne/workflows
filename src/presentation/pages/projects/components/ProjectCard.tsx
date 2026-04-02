import React from 'react';
import { Project } from '../../../../domain/project/entities/Project';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ProjectCard({ project, onClick, onEdit, onDelete }: ProjectCardProps) {
  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div 
      className="group relative bg-[#0a0a0a] border border-white/5 rounded-xl p-5 cursor-pointer transition-all duration-300 hover:border-white/20 hover:shadow-[0_8px_30px_rgba(255,255,255,0.04)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={`打开项目 ${project.meta.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="font-medium text-base truncate flex-1 text-white pr-4">
          {project.meta.name}
        </h3>
        <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-1 -mt-1 -mr-1">
          <button 
            className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/20" 
            type="button" 
            aria-label="编辑"
            onClick={handleEdit}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              <path d="m15 5 4 4"/>
            </svg>
          </button>
          <button 
            className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/20" 
            type="button" 
            aria-label="删除"
            onClick={handleDelete}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"/>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
      
      {project.meta.description && (
        <p className="text-sm text-zinc-400 line-clamp-2 mb-4">
          {project.meta.description}
        </p>
      )}

      <div className="flex items-end justify-between mt-auto pt-2">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-zinc-600 font-medium">更新于 {formatDate(project.meta.updatedAt)}</p>
        </div>
        <span className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-zinc-300">
          0 个节点
        </span>
      </div>
    </div>
  );
}
