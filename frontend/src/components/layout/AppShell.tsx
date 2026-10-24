import { useState, useEffect, useCallback } from 'react';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { useSidebar } from '../../hooks/useSidebar';
import type { Screen } from '../../app/navigation';
import type { Policies } from '../../api/types';

interface AppShellProps {
  activeScreen: Screen;
  actorId: string;
  setActorId: (id: string) => void;
  policies: Policies | null;
  apiMode: 'stub' | 'live';
  llmBadgeFull: string;
  navigation: (screen: Screen) => void;
  children: React.ReactNode;
}

export function AppShell({
  activeScreen,
  actorId,
  setActorId,
  policies,
  apiMode,
  llmBadgeFull,
  navigation,
  children,
}: AppShellProps) {
  const { state, isMobile, isCollapsed, isMobileOpen, toggle, closeMobile } = useSidebar();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleNavigate = useCallback((screen: Screen) => {
    navigation(screen);
  }, [navigation]);

  // Don't render until mounted to avoid hydration mismatch - but keep hook order
  if (!mounted) {
    return (
      <div className="app-shell" style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <div style={{ padding: 'var(--space-page)' }}>Loading…</div>
      </div>
    );
  }

  return (
    <div className="app-shell" style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={closeMobile}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(8, 11, 4, 0.38)',
            zIndex: 'var(--z-drawer-backdrop)',
            display: isMobile ? 'block' : 'none',
          }}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <Sidebar
        state={state}
        activeScreen={activeScreen}
        onNavigate={handleNavigate}
        onCloseMobile={closeMobile}
        llmBadgeFull={llmBadgeFull}
        isMobile={isMobile}
      />

      {/* Main Content */}
      <main className="main-content" style={{ marginLeft: isMobile ? 0 : (isCollapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width-expanded)') }}>
        {/* Topbar */}
        <Topbar
          onMenuClick={toggle}
          screenLabel={['command', 'evaluations', 'execution', 'supply-graph', 'audit-trail', 'evaluation-progress'].includes(activeScreen) ? activeScreen : 'Command Center'}
          actorId={actorId}
          onActorChange={setActorId}
          policies={policies}
          apiMode={apiMode}
        />

        {/* Page Content */}
        <div className="page-content" style={{ padding: 'var(--space-page)', maxWidth: 'var(--content-max-width)', margin: '0 auto' }}>
          <div className="synthetic-banner neu-card subtle" style={{ marginBottom: 'var(--space-section)' }} role="note">
            <strong>SYNTHETIC DATA</strong>
            <span>All companies, prices, schedules and outcomes in this demo are fictional.</span>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}