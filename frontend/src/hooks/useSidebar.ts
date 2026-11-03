import { useState, useEffect, useCallback } from 'react';

export type SidebarState = 'expanded' | 'collapsed' | 'mobile-open';

const STORAGE_KEY = 'aegisshield:sidebar-state';
const DEFAULT_STATE: SidebarState = 'expanded';
const MOBILE_BREAKPOINT = 768;

function readStoredState(): SidebarState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'expanded' || stored === 'collapsed') return stored;
  } catch { /* ignore */ }
  return DEFAULT_STATE;
}

export function useSidebar() {
  const [state, setState] = useState<SidebarState>(readStoredState);

  const [isMobile, setIsMobile] = useState(false);

  // Check mobile breakpoint
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Persist desktop state only. Phone state is ephemeral: a drawer that is
  // open or closed must not leak into the desktop preference.
  useEffect(() => {
    if (!isMobile) {
      try {
        localStorage.setItem(STORAGE_KEY, state);
      } catch { /* ignore */ }
    }
  }, [state, isMobile]);

  // Returning to desktop restores the stored desktop preference.
  useEffect(() => {
    if (!isMobile) setState(readStoredState());
  }, [isMobile]);

  // On phones the navigation starts closed (collapsed = drawer hidden).
  useEffect(() => {
    if (isMobile && state === 'expanded') {
      setState('collapsed');
    }
  }, [isMobile, state]);

  // On phones the menu button flips the drawer open/closed. On desktop it
  // flips expanded/collapsed.
  const toggle = useCallback(() => {
    setState(prev => {
      if (isMobile) return prev === 'mobile-open' ? 'collapsed' : 'mobile-open';
      return prev === 'collapsed' ? 'expanded' : 'collapsed';
    });
  }, [isMobile]);

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