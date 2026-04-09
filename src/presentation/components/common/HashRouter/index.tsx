"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

/**
 * HashRouter 上下文
 *
 * 提供 hash 路由的状态和导航方法。
 * 用于 Tauri 静态导出应用中的客户端路由。
 */

type Route = {
  path: string;
  params: Record<string, string>;
};

type HashRouterContextType = {
  route: Route | null;
  navigate: (path: string, params?: Record<string, string>) => void;
  navigateToCanvas: (projectId: string) => void;
  navigateToProjects: () => void;
};

const HashRouterContext = createContext<HashRouterContextType | null>(null);

/**
 * 解析 hash 路由
 *
 * 支持的格式：
 * - #/projects
 * - #/canvas?projectId=xxx
 */
function parseHash(hash: string): Route | null {
  // 移除开头的 # 或 #/
  let cleanHash = hash.replace(/^#\/?/, '');

  if (!cleanHash) {
    return null;
  }

  const [path, queryString] = cleanHash.split('?');
  const params: Record<string, string> = {};

  if (queryString) {
    const searchParams = new URLSearchParams(queryString);
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
  }

  return { path, params };
}

/**
 * 构建 hash 字符串
 */
function buildHash(path: string, params?: Record<string, string>): string {
  let hash = `#/${path}`;

  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams(params);
    hash += `?${searchParams.toString()}`;
  }

  return hash;
}

/**
 * HashRouter Provider
 *
 * 监听 hash 变化，提供路由状态和导航方法。
 */
export function HashRouterProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<Route | null>(() => {
    // 初始化时解析当前 hash
    if (typeof window !== 'undefined') {
      return parseHash(window.location.hash);
    }
    return null;
  });

  // 监听 hash 变化
  useEffect(() => {
    const handleHashChange = () => {
      const newRoute = parseHash(window.location.hash);
      setRoute(newRoute);
    };

    // 初始化时也触发一次
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 导航到指定路径
  const navigate = useCallback((path: string, params?: Record<string, string>) => {
    const hash = buildHash(path, params);
    window.location.hash = hash;
  }, []);

  // 导航到 Canvas 页面
  const navigateToCanvas = useCallback((projectId: string) => {
    navigate('canvas', { projectId });
  }, [navigate]);

  // 导航到项目列表页面
  const navigateToProjects = useCallback(() => {
    navigate('projects');
  }, [navigate]);

  const value = useMemo(() => ({
    route,
    navigate,
    navigateToCanvas,
    navigateToProjects,
  }), [route, navigate, navigateToCanvas, navigateToProjects]);

  return (
    <HashRouterContext.Provider value={value}>
      {children}
    </HashRouterContext.Provider>
  );
}

/**
 * useHashRouter Hook
 *
 * 获取 hash 路由上下文。
 */
export function useHashRouter() {
  const context = useContext(HashRouterContext);
  if (!context) {
    throw new Error('useHashRouter must be used within a HashRouterProvider');
  }
  return context;
}

/**
 * HashRoutes 组件
 *
 * 根据当前路由渲染对应的组件。
 *
 * 用法:
 * <HashRoutes
 *   routes={{
 *     projects: <ProjectsPage />,
 *     canvas: <CanvasPage />,
 *   }}
 *   fallback={<NotFoundPage />}
 * />
 */
export function HashRoutes({
  routes,
  fallback = null,
}: {
  routes: Record<string, React.ReactNode>;
  fallback?: React.ReactNode;
}) {
  const { route } = useHashRouter();

  // 如果没有路由，渲染 fallback
  if (!route) {
    return fallback;
  }

  const component = routes[route.path];
  return component ?? fallback;
}
