
import { useEffect } from 'react';
import { navItems, screenLabel, type Screen } from '../../app/navigation';

interface SidebarProps {
  state: 'expanded' | 'collapsed' | 'mobile-open';
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
  onCloseMobile: () => void;
  llmBadgeFull: string;
  isMobile: boolean;
}

export function Sidebar({
  state,
  activeScreen,
  onNavigate,
  onCloseMobile,
  llmBadgeFull,
  isMobile,
}: SidebarProps) {
  const isExpanded = state === 'expanded';
  const isMobileOpen = state === 'mobile-open';

  useEffect(() => {
    if (isMobileOpen) onCloseMobile();
  }, [activeScreen, isMobileOpen, onCloseMobile]);

  if (isMobile && state === 'collapsed') return null;

  return (
    <aside
      className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`}
      style={{
        width: isExpanded
          ? 'var(--sidebar-width-expanded)'
          : isMobileOpen
            ? '100%'
            : 'var(--sidebar-width-collapsed)',
      }}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="brand">
        <div className="brand-mark">A</div>
        {(isExpanded || isMobileOpen) && (
          <div>
            <strong>AegisShield</strong>
            <span>AI RECOVERY PLATFORM</span>
          </div>
        )}
      </div>

      <nav
        className="sidebar-nav"
        aria-label="Workspace navigation"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-1)',
          flex: 1,
        }}
      >
        {(isExpanded || isMobileOpen) && (
          <p className="nav-heading">WORKSPACE</p>
        )}

        {navItems.map((item) => (
          <ui5-button
            key={item.id}
            design={activeScreen === item.id ? 'Emphasized' : 'Transparent'}
            className={`nav-item ${activeScreen === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
            style={{
              justifyContent: isExpanded || isMobileOpen ? 'flex-start' : 'center',
              width: '100%',
            }}
            aria-current={activeScreen === item.id ? 'page' : undefined}
            title={isExpanded || isMobileOpen ? undefined : screenLabel(item.id)}
          >
            <item.icon aria-hidden="true" size={18} strokeWidth={1.75} />
            {(isExpanded || isMobileOpen) && (
              <span style={{ marginLeft: 'var(--space-3)' }}>
                {item.label}
              </span>
            )}
          </ui5-button>
        ))}
      </nav>

      <div
        className="sidebar-bottom"
        style={{
          display: isExpanded || isMobileOpen ? 'grid' : 'none',
        }}
      >
        <span className="status-dot" aria-hidden="true" />
        <small className="llm-badge" aria-label="LLM mode">
          {llmBadgeFull}
        </small>
      </div>

      {isMobileOpen && (
        <ui5-button
          design="Default"
          onClick={onCloseMobile}
          style={{ marginTop: 'var(--space-4)', width: '100%' }}
        >
          Close navigation
        </ui5-button>
      )}
    </aside>
  );
}
