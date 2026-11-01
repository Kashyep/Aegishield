
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
          aria-label="Toggle navigation"
          style={{ color: '#527d20' }}
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
      </div>
    </header>
  );
}
