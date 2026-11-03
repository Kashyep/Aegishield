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
  isMobile?: boolean;
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
  isMobile = false,
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
  const shellbarRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = shellbarRef.current;
    if (el) {
      Object.assign(el, {
        accessibilityAttributes: { logo: { name: 'AegisShield AI' } },
      });
    }
  }, []);
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
    <div
      slot={slot ?? 'header'}
      className="topbar-container"
      style={{
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <ui5-shellbar
        ref={shellbarRef}
        primaryTitle="AegisShield AI"
        secondaryTitle="Supply-Chain Recovery Preflight"
        // On phones a forced-open search goes full-width and covers the menu button.
        showSearchField={!isMobile}
        accessibleName={`AegisShield AI - ${screenLabel}`}
        {...({ showCoPilot: false })}
        accessibilityAttributes={{
          logo: { name: 'AegisShield AI' },
        }}
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
            boxShadow: 'var(--sapContent_Shadow0, 0 1px 3px rgba(0, 0, 0, 0.12))',
            userSelect: 'none',
          }}
          aria-hidden="true"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
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

        {/* Theme Toggle in Profile Slot */}
        <ui5-avatar
          slot="profile"
          icon={currentTheme === 'sap_horizon' ? 'palette' : 'light-mode'}
          shape="Circle"
          accessibleName="Toggle light/dark theme"
          title={`Switch to ${currentTheme === 'sap_horizon' ? 'Dark' : 'Light'} theme`}
        />
      </ui5-shellbar>

      {/* Dedicated Toolbar Bar: Scenario switcher, Role switcher, Simulated identity, STUB tag */}
      <div
        className="topbar-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 16px',
          background: 'var(--sapShell_Background, var(--sapBackgroundColor, #f5f6f7))',
          borderBottom: '1px solid var(--sapList_BorderColor, rgba(0, 0, 0, 0.08))',
          gap: '12px',
          flexWrap: 'wrap',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
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
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
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
      </div>
    </div>
  );
}
