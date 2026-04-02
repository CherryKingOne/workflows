"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Project } from '../../../../domain/project/entities/Project';

interface CanvasBoardProps {
  project: Project | null;
}

/**
 * 画布页面主组件 (CanvasBoard)
 * 
 * 作用 (Purpose):
 * 提供一个无限大的可拖拽画布面板，以及顶部的菜单栏和底部的工具栏。
 * 遵循深色流畅主题 (Sleek Dark Theme)。
 *
 * [Update 2026-04-03] - 根据原型图 canvas.html 复刻设计。
 */
export function CanvasBoard({ project }: CanvasBoardProps) {
  const router = useRouter();
  
  // 画布拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: -1500, y: -1200 });
  const dragStartRef = useRef({ x: 0, y: 0 });

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });

  // 存储管理弹窗状态
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);

  // 鼠标操作画布
  const handleMouseDown = (e: React.MouseEvent) => {
    // 忽略点击在 UI 元素上的拖拽，只允许在画布背景上拖拽
    if ((e.target as Element).closest('header') || (e.target as Element).closest('.fixed-ui') || (e.target as Element).closest('#context-menu')) {
      return;
    }
    // 左键拖拽，右键显示菜单（这里屏蔽掉左键点击直接显示菜单的行为，改为右键或者后续通过别的交互显示）
    if (e.button !== 0) return;

    setIsDragging(true);
    setContextMenu(prev => ({ ...prev, visible: false })); // 开始拖拽时隐藏菜单
    
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if ((e.target as Element).closest('header') || (e.target as Element).closest('.fixed-ui')) {
      return;
    }
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      visible: true
    });
  };

  // 全局事件绑定
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    
    // 点击空白处关闭菜单
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('#context-menu')) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(prev => ({ ...prev, visible: false }));
        setIsStorageModalOpen(false);
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleEsc);
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden text-gray-300 font-sans select-none bg-black relative">

      {/* ========================================================= */}
      {/* 1. 画布背景容器 (Canvas Layer) */}
      {/* ========================================================= */}
      <div 
        className={`absolute inset-0 overflow-hidden transition-cursor duration-75 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} bg-black`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
      >
        {/* 光滑玻璃底板反光层 - 增强反光与光泽 */}
        <div 
          className="absolute inset-0 pointer-events-none z-0 mix-blend-screen"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 30%, transparent 50%, rgba(255,255,255,0.03) 100%), radial-gradient(circle at 50% 0%, rgba(255,255,255,0.15) 0%, transparent 60%)',
          }}
        />

        {/* 无限网格点阵层 - 放在反光层之上 */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            backgroundPosition: `${position.x}px ${position.y}px`,
            backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.4) 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* 边缘强烈暗角，用于营造玻璃厚度和内陷感 */}
        <div 
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            boxShadow: 'inset 0 0 150px rgba(0,0,0,1), inset 0 0 50px rgba(0,0,0,0.8)'
          }}
        />

        <div 
          className="absolute z-10" 
          style={{ 
            left: `${position.x}px`, 
            top: `${position.y}px`,
          }}
        >
          {/* 这里将是节点渲染的地方 */}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. 顶部导航栏 (Header) */}
      {/* ========================================================= */}
      <header className="fixed top-4 inset-x-0 z-20 pointer-events-none fixed-ui">
        <div className="flex items-center justify-between px-4 max-w-[100vw] overflow-x-auto ui-scrollbar">
          
          {/* 左侧项目信息 */}
          <div 
            onClick={() => router.push('/projects')}
            className="flex shrink-0 items-center space-x-2 bg-[#1a1a1a] px-3 py-1.5 rounded-full border border-white/5 pointer-events-auto cursor-pointer hover:bg-[#252525] transition-colors shadow-lg"
          >
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(59,130,246,0.5)]">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
            </div>
            <span className="text-xs font-medium text-white truncate max-w-[150px]">
              {project ? project.meta.name : '未命名项目'}
            </span>
          </div>

          {/* 右侧工具栏 */}
          <div className="bg-[#171717]/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full flex items-center space-x-4 text-[11px] pointer-events-auto shrink-0 shadow-lg">
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                <span>90%</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4 border-l border-white/10 pl-4">
              <button className="flex items-center space-x-1 hover:text-white transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                <span>下载</span>
              </button>
              <button className="hover:text-white transition-colors">清空</button>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsStorageModalOpen(true); }} 
                className="flex items-center space-x-1 hover:text-white transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                <span>存储</span>
              </button>
              <button className="flex items-center space-x-1 hover:text-white transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path></svg>
                <span>API 设置</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 3. 左下角帮助 & 右下角导航小地图 */}
      {/* ========================================================= */}
      <div className="fixed bottom-4 left-4 z-20 fixed-ui">
        <button className="w-8 h-8 bg-[#171717]/80 backdrop-blur-md border border-white/10 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors shadow-lg text-white">
          <span className="text-xs font-medium">?</span>
        </button>
      </div>

      <div className="fixed bottom-4 right-4 z-20 fixed-ui pointer-events-none">
        <div className="w-48 h-28 bg-[#171717]/80 backdrop-blur-md rounded-lg border border-white/10 relative overflow-hidden shadow-lg">
          <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '10px 10px'}}></div>
          {/* 当前视口框指示器 */}
          <div className="absolute bottom-2 right-2 w-12 h-8 border border-white/40 bg-white/5 rounded-sm"></div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. 右键菜单 (Context Menu) */}
      {/* ========================================================= */}
      {contextMenu.visible && (
        <div 
          id="context-menu" 
          className="fixed z-50 bg-[#1a1a1a]/95 backdrop-blur-md border border-[#2d2d2d] rounded-xl shadow-2xl py-1 overflow-visible select-none fixed-ui"
          style={{ 
            left: `${Math.min(contextMenu.x, typeof window !== 'undefined' ? window.innerWidth - 200 : contextMenu.x)}px`, 
            top: `${Math.min(contextMenu.y, typeof window !== 'undefined' ? window.innerHeight - 300 : contextMenu.y)}px` 
          }}
        >
          {/* 菜单项列表 */}
          <div className="flex flex-col px-1 min-w-[180px] pt-1">
            <button className="flex items-center px-3 py-1.5 hover:bg-white/5 rounded-md group transition-colors">
              <svg className="w-4 h-4 text-gray-400 group-hover:text-white mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
              <span className="text-[13px] text-gray-300 group-hover:text-white">上传文件</span>
            </button>
            <button className="flex items-center px-3 py-1.5 hover:bg-white/5 rounded-md group transition-colors">
              <svg className="w-4 h-4 text-gray-400 group-hover:text-white mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              <span className="text-[13px] text-gray-300 group-hover:text-white">图片</span>
            </button>
            <button className="flex items-center px-3 py-1.5 hover:bg-white/5 rounded-md group transition-colors">
              <svg className="w-4 h-4 text-gray-400 group-hover:text-white mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
              <span className="text-[13px] text-gray-300 group-hover:text-white">预览</span>
            </button>
            <button className="flex items-center px-3 py-1.5 hover:bg-white/5 rounded-md group transition-colors">
              <svg className="w-4 h-4 text-gray-400 group-hover:text-white mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
              <span className="text-[13px] text-gray-300 group-hover:text-white">对比</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. 弹窗区 (Modals) */}
      {/* ========================================================= */}

      {/* 存储管理弹窗 */}
      {isStorageModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center fixed-ui">
          <div className="w-full max-w-[720px] bg-[#161616] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div className="flex items-center gap-3 text-gray-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                <span className="text-[15px] font-medium">本地存储管理</span>
              </div>
              <button onClick={() => setIsStorageModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l18 18"></path></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 ui-scrollbar">
              <section className="border border-white/5 bg-white/5 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-blue-400">
                  <h3 className="text-sm font-medium text-gray-200">下载目录设置</h3>
                </div>
                <div className="bg-black/30 border border-white/5 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-xs text-gray-500">当前下载目录</span>
                  <span className="text-xs text-gray-300">Default_Media</span>
                </div>
                <button className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all">
                  选择下载目录
                </button>
              </section>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
