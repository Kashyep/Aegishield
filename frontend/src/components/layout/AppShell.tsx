import { useState, useEffect, useCallback } from 'react';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { useSidebar } from '../../hooks/useSidebar';
import type { Screen } from '../../app/navigation';
import { screenLabel } from '../../app/navigation';
import type { Policies } from '../../api/types';

import '@ui5/webcomponents-fiori/dist/NavigationLayout.js';
import '@ui5/webcomponents-fiori/dist/ShellBar.js';
import '@ui5/webcomponents-fiori/dist/SideNavigation.js';
import '@ui5/webcomponents-fiori/dist/SideNavigationItem.js';
import '@ui5/webcomponents/dist/SegmentedButton.js';
import '@ui5/webcomponents/dist/SegmentedButtonItem.js';
import '@ui5/webcomponents/dist/Avatar.js';
import '@ui5/webcomponents/dist/Select.js';
import '@ui5/webcomponents/dist/Input.js';

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

  // Escape dismisses the phone drawer.
  useEffect(() => {
    if (!isMobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMobile();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMobileOpen, closeMobile]);

  const handleNavigate = useCallback((screen: Screen) => {
    navigation(screen);
    if (isMobile) closeMobile();
  }, [navigation, isMobile, closeMobile]);

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="app-shell" style={{ minHeight: '100vh', background: 'var(--sapBackgroundColor, #f5f6f7)' }}>
        <div style={{ padding: 'var(--space-page, 1.5rem)', fontFamily: "'72', sans-serif" }}>Loading…</div>
      </div>
    );
  }

  const layoutMode = isMobileOpen ? 'Expanded' : (isCollapsed ? 'Collapsed' : 'Expanded');

  return (
    <div className="app-shell" style={{ minHeight: '100vh', width: '100%', background: 'var(--sapBackgroundColor, #f5f6f7)' }}>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={closeMobile}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            // Must sit below the navigation aside (z-index 2 inside ui5-navigation-layout's
            // stacking context) so the drawer is above it, and above the page content.
            zIndex: 1,
            display: isMobile ? 'block' : 'none',
          }}
          aria-hidden="true"
        />
      )}

      {/* Fiori Navigation Layout with ShellBar and SideNavigation */}
      <ui5-navigation-layout
        mode={layoutMode}
        style={{ minHeight: '100vh', width: '100%' }}
      >
        {/* Topbar in header slot */}
        <Topbar
          slot="header"
          onMenuClick={toggle}
          isMobile={isMobile}
          screenLabel={screenLabel(activeScreen)}
          actorId={actorId}
          onActorChange={setActorId}
          policies={policies}
          apiMode={apiMode}
        />

        {/* Sidebar in sideContent slot */}
        <Sidebar
          slot="sideContent"
          state={state}
          activeScreen={activeScreen}
          onNavigate={handleNavigate}
          onCloseMobile={closeMobile}
          llmBadgeFull={llmBadgeFull}
          isMobile={isMobile}
          actorId={actorId}
          policies={policies}
        />

        {/* Main Content Area */}
        <main
          className="main-content"
          style={{
            padding: 'var(--space-page, 1.5rem)',
            maxWidth: 'var(--content-max-width, 1400px)',
            margin: '0 auto',
            boxSizing: 'border-box',
            width: '100%',
          }}
        >
          {/* Synthetic Data Banner */}
          <div
            className="synthetic-banner"
            style={{
              marginBottom: 'var(--space-section, 1rem)',
              background: 'var(--sapTile_Background, #ffffff)',
              border: '1px solid var(--color-border-light, #e5e5e5)',
              borderRadius: 'var(--radius-lg)',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontSize: 'var(--text-sm)',
              boxShadow: 'var(--sapContent_Shadow0, 0 1px 2px rgba(0, 0, 0, 0.05))',
            }}
            role="note"
          >
            <strong style={{ color: 'var(--sapInformativeTextColor, #0854a0)', letterSpacing: '0.04em' }}>SYNTHETIC DATA</strong>
            <span style={{ color: 'var(--sapTextColor, #1d2d3e)' }}>All companies, prices, schedules and outcomes in this demo are fictional.</span>
          </div>

          {children}
        </main>
      </ui5-navigation-layout>
    </div>
  );
}
