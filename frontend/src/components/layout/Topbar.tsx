import { useState, useRef, useEffect } from 'react';
import type { Policies } from '../../api/types';

interface TopbarProps {
  onMenuClick: () => void;
  screenLabel: string;
  actorId: string;
  onActorChange: (id: string) => void;
  policies?: Policies | null;
  apiMode: 'stub' | 'live';
}

export function Topbar({
  onMenuClick,
  screenLabel,
  actorId,
  onActorChange,
  policies,
  apiMode,
}: TopbarProps) {
  const [showActorMenu, setShowActorMenu] = useState(false);
  const actorMenuRef = useRef<HTMLDivElement>(null);

  const actors = policies?.demo_actors ?? [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actorMenuRef.current && !actorMenuRef.current.contains(event.target as Node)) {
        setShowActorMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="topbar neu-card raised">
      <div className="topbar-left">
        <button
          className="neu-btn-icon neu-btn-secondary"
          onClick={onMenuClick}
          aria-label="Toggle navigation"
          aria-expanded="false"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="topbar-breadcrumb">
          <span className="eyebrow">Recovery workspace</span>
          <span className="divider" aria-hidden="true">/</span>
          <span>{screenLabel}</span>
        </div>
      </div>

      <div className="topbar-tools" ref={actorMenuRef}>
        <div className="actor-selector" style={{ position: 'relative' }}>
          <label htmlFor="actor-select" className="eyebrow">Simulated identity</label>
          <select
            id="actor-select"
            className="neu-input neu-select"
            value={actorId}
            onChange={(e) => onActorChange(e.target.value)}
            onFocus={() => setShowActorMenu(true)}
            aria-expanded={showActorMenu}
          >
            {actors.map((actor) => (
              <option key={actor.actor_id} value={actor.actor_id}>
                {actor.display_name}
              </option>
            ))}
          </select>
        </div>

        <span className="neu-chip neu-chip-neutral user-chip" role="status" aria-live="polite">
          {apiMode === 'stub' ? 'Stub mode · Fixtures' : 'Live API'}
        </span>
      </div>
    </header>
  );
}