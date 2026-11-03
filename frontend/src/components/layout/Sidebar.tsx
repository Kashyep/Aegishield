import { useCallback, useEffect, useRef } from 'react';
import { navItems, screenLabel, type Screen } from '../../app/navigation';
import type { Policies } from '../../api/types';

import '@ui5/webcomponents-fiori/dist/SideNavigation.js';
import '@ui5/webcomponents-fiori/dist/SideNavigationItem.js';
import '@ui5/webcomponents-fiori/dist/SideNavigationGroup.js';
import '@ui5/webcomponents/dist/Avatar.js';
import '@ui5/webcomponents/dist/Button.js';
import '@ui5/webcomponents-icons/dist/bbyd-dashboard.js';
import '@ui5/webcomponents-icons/dist/radar-chart.js';
import '@ui5/webcomponents-icons/dist/checklist.js';
import '@ui5/webcomponents-icons/dist/play.js';
import '@ui5/webcomponents-icons/dist/org-chart.js';
import '@ui5/webcomponents-icons/dist/overview-chart.js';
import '@ui5/webcomponents-icons/dist/history.js';
import '@ui5/webcomponents-icons/dist/connected.js';
import '@ui5/webcomponents-icons/dist/decline.js';

interface SidebarProps {
  state: 'expanded' | 'collapsed' | 'mobile-open';
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
  onCloseMobile: () => void;
  llmBadgeFull: string;
  isMobile: boolean;
  actorId?: string;
  policies?: Policies | null;
  slot?: string;
}

interface SideNavEventDetail {
  item: HTMLElement;
}

function screenIcon(id: string): string {
  switch (id) {
    case 'supply-network':
      return 'overview-chart';
    case 'command':
      return 'bbyd-dashboard';
    case 'early-warnings':
      return 'radar-chart';
    case 'evaluations':
      return 'checklist';
    case 'execution':
      return 'play';
    case 'supply-graph':
      return 'org-chart';
    case 'audit-trail':
      return 'history';
    default:
      return 'bbyd-dashboard';
  }
}

export function Sidebar({
  state,
  activeScreen,
  onNavigate,
  onCloseMobile,
  llmBadgeFull,
  isMobile,
  actorId = 'USR-PRIYA',
  policies,
  slot,
}: SidebarProps) {
  const isExpanded = state === 'expanded';
  const isMobileOpen = state === 'mobile-open' && isMobile;
  const isCollapsed = !isExpanded && !isMobileOpen;

  // Close the mobile drawer when an item is activated (including the current screen).
  const navigate = useCallback((screen: Screen) => {
    onNavigate(screen);
    if (isMobileOpen) onCloseMobile();
  }, [onNavigate, isMobileOpen, onCloseMobile]);

  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const listener = (event: Event) => {
      const customEvt = event as CustomEvent<SideNavEventDetail>;
      const item = customEvt.detail?.item;
      const screenId = item?.getAttribute('data-id') as Screen | null;
      if (screenId) {
        navigate(screenId);
      }
    };
    el.addEventListener('selection-change', listener);
    el.addEventListener('item-click', listener);
    return () => {
      el.removeEventListener('selection-change', listener);
      el.removeEventListener('item-click', listener);
    };
  }, [navigate]);

  const handleSelectionChange = (event: CustomEvent<SideNavEventDetail>) => {
    const item = event.detail?.item;
    const screenId = item?.getAttribute('data-id') as Screen | null;
    if (screenId) {
      navigate(screenId);
    }
  };

  const currentActor = policies?.demo_actors?.find((a) => a.actor_id === actorId);

  const userName = actorId === 'USR-ARJUN'
    ? 'Arjun Mehta'
    : actorId === 'USR-VIEW'
      ? 'Guest Viewer'
      : (currentActor?.display_name?.replace(/ \([^)]+\)/, '') || 'Priya Sharma');

  const userRole = actorId === 'USR-ARJUN'
    ? 'Trade Compliance Officer'
    : actorId === 'USR-VIEW'
      ? 'Observer'
      : 'Supply Chain Manager';

  const userInitials = actorId === 'USR-ARJUN'
    ? 'AM'
    : actorId === 'USR-VIEW'
      ? 'GV'
      : 'PS';

  return (
    <div
      slot={slot ?? 'sideContent'}
      className="sidebar-container"
      style={{
        height: '100%',
        position: 'relative',
      }}
    >
      <ui5-side-navigation
        ref={navRef}
        collapsed={isCollapsed}
        accessibleName="Main navigation"
        onselection-change={handleSelectionChange}
        style={{
          height: '100%',
          fontFamily: "'72', sans-serif",
        }}
      >
        {/* User profile block replaces logo in Sidebar header */}
        <div
          slot="header"
          className="sidebar-user-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px',
            boxSizing: 'border-box',
            borderBottom: '1px solid var(--sapList_BorderColor, rgba(0, 0, 0, 0.08))',
            background: 'var(--sapList_HeaderBackground, transparent)',
          }}
        >
          <ui5-avatar
            initials={userInitials}
            size="M"
            colorScheme={actorId === 'USR-ARJUN' ? 'Accent3' : 'Accent6'}
            accessibleName={userName}
          />
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            <span
              style={{
                fontFamily: "'72', sans-serif",
                fontWeight: 600,
                fontSize: '14px',
                color: 'var(--sapTextColor, #1d2d3e)',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {userName}
            </span>
            <span
              style={{
                fontFamily: "'72', sans-serif",
                fontSize: '12px',
                color: 'var(--sapContent_LabelColor, #6a6d70)',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {userRole}
            </span>
          </div>
        </div>

        {/* Main navigation items */}
        {navItems.map((item) => (
          <ui5-side-navigation-item
            key={item.id}
            data-id={item.id}
            text={item.label}
            icon={screenIcon(item.id)}
            selected={activeScreen === item.id}
            accessibleName={item.label}
            title={screenLabel(item.id)}
            onClick={() => navigate(item.id)}
          />
        ))}

        {/* Bottom / Fixed items */}
        <ui5-side-navigation-item
          slot="fixedItems"
          unselectable
          text={llmBadgeFull}
          icon="connected"
          accessibleName={`LLM mode: ${llmBadgeFull}`}
        />

        {isMobileOpen && (
          <ui5-side-navigation-item
            slot="fixedItems"
            text="Close navigation"
            icon="decline"
            design="Action"
            onClick={onCloseMobile}
            accessibleName="Close navigation"
          />
        )}
      </ui5-side-navigation>
      {/* Accessible LLM mode badge for automation / screen readers */}
      <span
        className="llm-badge"
        aria-label="LLM mode"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {llmBadgeFull}
      </span>
    </div>
  );
}
