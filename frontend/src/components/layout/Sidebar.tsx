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

  // Close mobile drawer on navigation
  useEffect(() => {
    if (isMobileOpen) onCloseMobile();
  }, [activeScreen, isMobileOpen, onCloseMobile]);

  if (isMobile && state === 'collapsed') return null; // Hidden on mobile when collapsed

  return (
    <aside
      className={`sidebar neu-card raised-lg ${isMobileOpen ? 'mobile-open' : ''}`}
      style={{
        width: isExpanded ? 'var(--sidebar-width-expanded)' :
               isMobileOpen ? '100%' :
               'var(--sidebar-width-collapsed)',
        transform: isMobileOpen ? 'translateX(0)' : 'translateX(0)',
      }}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div className="brand" style={{ opacity: isExpanded || isMobileOpen ? 1 : 0, pointerEvents: isExpanded || isMobileOpen ? 'auto' : 'none' }}>
        <div className="brand-mark neu-avatar">A</div>
        {isExpanded && (
          <div>
            <strong>AegisShield</strong>
            <span>AI RECOVERY PLATFORM</span>
          </div>
        )}
      </div>

      <nav
        className="sidebar-nav"
        aria-label="Workspace navigation"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', flex: 1 }}
      >
        {isExpanded && <p className="nav-heading">WORKSPACE</p>}
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item neu-btn neu-btn-ghost ${activeScreen === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
            style={{
              justifyContent: isExpanded ? 'flex-start' : 'center',
              padding: isExpanded ? 'var(--space-3) var(--space-3)' : 'var(--space-3)',
            }}
            aria-current={activeScreen === item.id ? 'page' : undefined}
            title={isExpanded ? undefined : screenLabel(item.id)}
          >
            <item.icon aria-hidden="true" size={18} strokeWidth={1.75} />
            {isExpanded && <span style={{ marginLeft: 'var(--space-3)' }}>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Sidebar bottom - status */}
      <div className="sidebar-bottom" style={{ display: isExpanded || isMobileOpen ? 'grid' : 'none' }}>
        <span className="status-dot" aria-hidden="true" />
        <small className="llm-badge" aria-label="LLM mode">{llmBadgeFull}</small>
      </div>

      {/* Mobile close button */}
      {isMobileOpen && (
        <button
          className="neu-btn neu-btn-secondary"
          onClick={onCloseMobile}
          style={{ marginTop: 'var(--space-4)', width: '100%' }}
        >
          Close navigation
        </button>
      )}
    </aside>
  );
}