import { useState } from 'react';
import { setTheme, getTheme } from '@ui5/webcomponents-base/dist/config/Theme.js';
import type { Policies } from '../../api/types';
interface TopbarProps {
  screenLabel: string;
  actorId: string;
  onActorChange: (actorId: string) => void;
  policies: Policies | null;
  apiMode: string;
  onMenuClick: () => void;
}

export function Topbar({
  screenLabel,
  actorId,
  onActorChange,
  policies,
  apiMode,
  onMenuClick,
}: TopbarProps) {
  const actors = policies?.demo_actors ?? [];

  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('aegis.theme')) || getTheme() || 'sap_horizon';
  });

  const handleThemeToggle = () => {
    const nextTheme = currentTheme === 'sap_horizon' ? 'sap_horizon_dark' : 'sap_horizon';
    setTheme(nextTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('aegis.theme', nextTheme);
    }
    setCurrentTheme(nextTheme);
  };
  return (
    <header
      className="topbar"
      style={{
        minHeight: '78px',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 26px',
        background: '#ffffff',
        border: '1px solid #dce3d8',
        borderRadius: '14px',
        boxShadow: '0 2px 8px rgba(30, 50, 30, 0.08)',
        gap: '20px',
      }}
    >
      <div
        className="topbar-left"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          minWidth: 0,
        }}
      >
       <ui5-button
  design="Default"
  icon="menu"
  onClick={onMenuClick}
  accessibleName="Toggle navigation"
/>

        <div
          className="topbar-breadcrumb"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            whiteSpace: 'nowrap',
          }}
        >
          <span className="eyebrow">Recovery workspace</span>
          <span className="divider" aria-hidden="true">/</span>
          <span>{screenLabel}</span>
        </div>
      </div>

      <div
        className="topbar-tools"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0,
        }}
      >
        <div
          className="actor-selector"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '3px',
            width: '345px',
            flexShrink: 0,
          }}
        >
          <label htmlFor="actor-select" className="eyebrow">
            Simulated identity
          </label>

          <select
            id="actor-select"
            value={actorId}
            onChange={(event) => onActorChange(event.target.value)}
            style={{
              width: '100%',
              height: '40px',
              boxSizing: 'border-box',
              padding: '0 12px',
              border: '1px solid #e1e7dc',
              borderRadius: '9px',
              background: '#f5f7f2',
              color: '#263328',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            {actors.map((actor) => (
              <option key={actor.actor_id} value={actor.actor_id}>
                {actor.display_name}
              </option>
            ))}
          </select>
        </div>

        <span
          className="neu-chip neu-chip-neutral user-chip"
          role="status"
          aria-live="polite"
          style={{
            whiteSpace: 'nowrap',
            borderRadius: '20px',
          }}
        >
          {apiMode === 'stub' ? 'STUB MODE · FIXTURES' : 'LIVE API'}
        </span>
        <ui5-button
          design="Transparent"
          icon={currentTheme === 'sap_horizon' ? 'palette' : 'light-mode'}
          onClick={handleThemeToggle}
          accessibleName="Toggle light/dark theme"
          title={`Switch to ${currentTheme === 'sap_horizon' ? 'Dark' : 'Light'} theme`}
        >
          {currentTheme === 'sap_horizon' ? 'Dark' : 'Light'}
        </ui5-button>
      </div>
    </header>
  );
}
