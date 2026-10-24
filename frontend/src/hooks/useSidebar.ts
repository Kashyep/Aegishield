import { useState, useEffect, useCallback } from 'react';

export type SidebarState = 'expanded' | 'collapsed' | 'mobile-open';

const STORAGE_KEY = 'aegisshield:sidebar-state';
const DEFAULT_STATE: SidebarState = 'expanded';
const MOBILE_BREAKPOINT = 768;

export function useSidebar() {
  const [state, setState] = useState<SidebarState>(() => {
    if (typeof window === 'undefined') return DEFAULT_STATE;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'expanded' || stored === 'collapsed') return stored;
    } catch { /* ignore */ }
    return DEFAULT_STATE;
  });

  const [isMobile, setIsMobile] = useState(false);

  // Check mobile breakpoint
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Persist state (except mobile-open)
  useEffect(() => {
    if (state !== 'mobile-open') {
      try {
        localStorage.setItem(STORAGE_KEY, state);
      } catch { /* ignore */ }
    }
  }, [state]);

  // Auto-collapse on mobile
  useEffect(() => {
    if (isMobile && state === 'expanded') {
      setState('mobile-open');
    }
  }, [isMobile, state]);

  const toggle = useCallback(() => {
    setState(prev => {
      if (prev === 'expanded') return 'collapsed';
      if (prev === 'collapsed') return 'expanded';
      return 'expanded'; // mobile-open -> expanded
    });
  }, []);

  const open = useCallback(() => setState('expanded'), []);
  const close = useCallback(() => setState('collapsed'), []);
  const openMobile = useCallback(() => setState('mobile-open'), []);
  const closeMobile = useCallback(() => setState(isMobile ? 'collapsed' : 'expanded'), [isMobile]);

  // Computed width
  const width = state === 'expanded' ? 'var(--sidebar-width-expanded)' :
                state === 'collapsed' ? 'var(--sidebar-width-collapsed)' : '100%';

  const isExpanded = state === 'expanded';
  const isCollapsed = state === 'collapsed';
  const isMobileOpen = state === 'mobile-open';

  return {
    state,
    isMobile,
    isExpanded,
    isCollapsed,
    isMobileOpen,
    width,
    toggle,
    open,
    close,
    openMobile,
    closeMobile,
    setState,
  };
}