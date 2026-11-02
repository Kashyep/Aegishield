import { useState, useRef, useEffect } from 'react';
import { setTheme, getTheme } from '@ui5/webcomponents-base/dist/config/Theme.js';
import type { Policies } from '../../api/types';

import '@ui5/webcomponents-fiori/dist/ShellBar.js';
import '@ui5/webcomponents-fiori/dist/ShellBarItem.js';
import '@ui5/webcomponents/dist/Button.js';
import '@ui5/webcomponents/dist/Select.js';
import '@ui5/webcomponents/dist/Option.js';
import '@ui5/webcomponents/dist/SegmentedButton.js';
import '@ui5/webcomponents/dist/SegmentedButtonItem.js';
import '@ui5/webcomponents/dist/Input.js';
import '@ui5/webcomponents/dist/Avatar.js';
import '@ui5/webcomponents/dist/Tag.js';
import '@ui5/webcomponents-icons/dist/palette.js';
import '@ui5/webcomponents-icons/dist/light-mode.js';
import '@ui5/webcomponents-icons/dist/menu.js';
import '@ui5/webcomponents-icons/dist/search.js';

interface TopbarProps {
  screenLabel: string;
  actorId: string;
  onActorChange: (actorId: string) => void;
  policies: Policies | null;
  apiMode: string;
  onMenuClick: () => void;
  slot?: string;
}

interface SegmentedChangeEventDetail {
  selectedItems: HTMLElement[];
}

export function Topbar({
  screenLabel,
  actorId,
  onActorChange,
  policies,
  apiMode,
  onMenuClick,
  slot,
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

  const segmentedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = segmentedRef.current;
    if (!el) return;
    const listener = (event: Event) => {
      const customEvt = event as CustomEvent<SegmentedChangeEventDetail>;
      const selectedItem = customEvt.detail?.selectedItems?.[0];
      const newActorId = selectedItem?.getAttribute('data-actor');
      if (newActorId) {
        onActorChange(newActorId);
      }
    };
    el.addEventListener('selection-change', listener);
    return () => el.removeEventListener('selection-change', listener);
  }, [onActorChange]);

  const handleRoleChange = (event: CustomEvent<SegmentedChangeEventDetail>) => {
    const selectedItem = event.detail?.selectedItems?.[0];
    const newActorId = selectedItem?.getAttribute('data-actor');
    if (newActorId) {
      onActorChange(newActorId);
    }
  };

  return (
    <ui5-shellbar
      slot={slot ?? 'header'}
      primaryTitle="AegisShield AI"
      secondaryTitle="Supply-Chain Recovery Preflight"
      showSearchField
      accessibleName={`AegisShield AI - ${screenLabel}`}
      {...({ showCoPilot: false })}
      onprofile-click={handleThemeToggle}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        fontFamily: "'72', sans-serif",
      }}
    >
      {/* Brand logo */}
      <div
        slot="logo"
        className="brand-mark"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: 'var(--sapBrandColor, #0070f2)',
          color: 'var(--sapContent_ContrastTextColor, #ffffff)',
          fontWeight: 700,
          fontFamily: "'72', sans-serif",
          fontSize: '18px',
          boxShadow: 'var(--sapContent_Shadow0, 0 1px 3px rgba(0, 0, 0, 0.12))',
          userSelect: 'none',
        }}
        aria-label="AegisShield Logo"
      >
        A
      </div>

      {/* Start Button: Menu toggle */}
      <ui5-button
        slot="startButton"
        icon="menu"
        design="Transparent"
        onClick={onMenuClick}
        accessibleName="Toggle navigation"
        tooltip="Toggle navigation"
      />

      {/* Search Input */}
      <ui5-input
        slot="searchField"
        showClearIcon
        placeholder="Search recovery workspace…"
        accessibleName="Search recovery workspace"
      />

      {/* Content slot: Scenario switcher, Role switcher, Simulated identity, STUB tag */}
      <div
        slot="content"
        className="shellbar-cluster"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'nowrap',
        }}
      >
        {/* Scenario Switcher */}
        <ui5-select
          accessibleName="Scenario switcher"
          title="Scenario"
          style={{ minWidth: '320px' }}
        >
          <ui5-option value="SCN-DEMO-001" selected>
            SCN-DEMO-001 Kedah Die Sort &amp; Kulim Flooding
          </ui5-option>
        </ui5-select>

        {/* Role Switcher */}
        <ui5-segmented-button
          ref={segmentedRef}
          accessibleName="Role switcher"
          onselection-change={handleRoleChange}
        >
          <ui5-segmented-button-item
            data-actor="USR-PRIYA"
            selected={actorId === 'USR-PRIYA'}
            onClick={() => onActorChange('USR-PRIYA')}
          >
            Supply Chain Manager (USR-PRIYA)
          </ui5-segmented-button-item>
          <ui5-segmented-button-item
            data-actor="USR-ARJUN"
            selected={actorId === 'USR-ARJUN'}
            onClick={() => onActorChange('USR-ARJUN')}
          >
            Trade Compliance Officer (USR-ARJUN)
          </ui5-segmented-button-item>
        </ui5-segmented-button>

        {/* Backwards-compatible actor select for Playwright test automation */}
        <div
          className="actor-selector"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <label
            htmlFor="actor-select"
            className="eyebrow"
            style={{
              fontFamily: "'72', sans-serif",
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--sapContent_LabelColor, #6a6d70)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
            }}
          >
            Simulated identity
          </label>
          <select
            id="actor-select"
            aria-label="Simulated identity"
            value={actorId}
            onChange={(event) => onActorChange(event.target.value)}
            style={{
              height: '32px',
              padding: '0 8px',
              borderRadius: '4px',
              border: '1px solid var(--sapField_BorderColor, #89919a)',
              background: 'var(--sapField_Background, #ffffff)',
              color: 'var(--sapTextColor, #1d2d3e)',
              fontFamily: "'72', sans-serif",
              fontSize: '13px',
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

        {/* API Mode Tag */}
        <ui5-tag
          design="Neutral"
          colorScheme="Set2"
          style={{ whiteSpace: 'nowrap' }}
        >
          {apiMode === 'stub' ? 'STUB MODE · FIXTURES' : 'LIVE API'}
        </ui5-tag>
      </div>

      {/* Theme Toggle in items slot */}
      <ui5-shellbar-item
        slot="items"
        icon={currentTheme === 'sap_horizon' ? 'palette' : 'light-mode'}
        text={currentTheme === 'sap_horizon' ? 'Switch to Dark theme' : 'Switch to Light theme'}
        onclick={handleThemeToggle}
      />

      {/* Theme Toggle in Profile Slot */}
      <ui5-avatar
        slot="profile"
        icon={currentTheme === 'sap_horizon' ? 'palette' : 'light-mode'}
        shape="Circle"
        interactive
        accessibleName="Toggle light/dark theme"
        title={`Switch to ${currentTheme === 'sap_horizon' ? 'Dark' : 'Light'} theme`}
        onClick={handleThemeToggle}
      />
    </ui5-shellbar>
  );
}
