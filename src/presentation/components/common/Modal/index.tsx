import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  // use a small timeout to bypass strict mode complaining about synchronous state updates in effects
  // or simply bypass the hydration issues by rendering after a tick
  useEffect(() => {
    let isSubscribed = true;
    Promise.resolve().then(() => {
      if (isSubscribed) setMounted(true);
    });
    return () => { isSubscribed = false; };
  }, []);

  useEffect(() => {
    // 监听 Esc 键关闭弹窗
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden'; // 防止背景滚动
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* 弹窗内容 */}
      <div 
        className="relative bg-[#111111] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgb(0,0,0,0.7)] w-full max-w-md p-6 transform transition-all"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            {title}
          </h2>
          <button 
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors duration-200 p-1.5 rounded-lg hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
            aria-label="关闭"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/>
              <path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>
        
        <div className="mb-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
