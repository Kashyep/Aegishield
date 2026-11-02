import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import '@ui5/webcomponents/dist/Button.js';
import '@ui5/webcomponents/dist/Title.js';
import '@ui5/webcomponents-icons/dist/decline.js';
import '@ui5/webcomponents-fiori/dist/FlexibleColumnLayout.js';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
  className?: string;
  restoreFocusTo?: HTMLElement | null;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  width,
  className = '',
  restoreFocusTo,
}: DrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = restoreFocusTo ?? (document.activeElement as HTMLElement);
    drawerRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;

      const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), ui5-button:not([disabled]), input:not([disabled]), ui5-input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (active === drawerRef.current || !drawerRef.current.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    const handleDocumentClick = (event: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('click', handleDocumentClick);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleDocumentClick);
      const trigger = restoreFocusTo ?? previouslyFocused.current;

      if (trigger?.isConnected) {
        requestAnimationFrame(() => {
          if (trigger.isConnected) {
            trigger.focus();
          }
        });
      }
    };
  }, [isOpen, onClose, restoreFocusTo]);

  if (!isOpen) return null;

  const drawerContent = (
    <aside
      ref={drawerRef}
      className={`ae-drawer neu-drawer ae-side-column ${className}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      aria-label={title}
      tabIndex={-1}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: width || 'var(--drawer-width, 480px)',
        maxWidth: '100vw',
        height: '100vh',
        zIndex: 100,
        background: 'var(--sapTile_Background)',
        borderLeft: '1px solid var(--sapTile_BorderColor)',
        boxShadow: 'var(--sapContent_Shadow3, -4px 0 16px rgba(0, 0, 0, 0.15))',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <header
        className="ae-dialog-header"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          padding: 'var(--space-4) var(--space-6)',
          borderBottom: '1px solid var(--sapGroup_ContentBorderColor, var(--sapTile_BorderColor))',
          background: 'var(--sapTile_Background)',
          flexShrink: 0,
        }}
      >
        <div>
          <p
            className="eyebrow"
            style={{
              margin: '0 0 var(--space-1) 0',
              color: 'var(--sapContent_LabelColor)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontFamily: "'72', sans-serif",
            }}
          >
            EVALUATION EVIDENCE
          </p>
          <h2
            id="drawer-title"
            style={{
              margin: 0,
              fontSize: 'var(--text-xl)',
              color: 'var(--sapTextColor)',
              fontFamily: "'72', sans-serif",
              fontWeight: 'bold',
            }}
          >
            {title}
          </h2>
        </div>
        <ui5-button
          design="Transparent"
          icon="decline"
          onClick={onClose}
          aria-label={`Close ${title.toLowerCase()}`}
          accessibleName={`Close ${title.toLowerCase()}`}
          title={`Close ${title.toLowerCase()}`}
        />
      </header>
      <section
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-4) var(--space-6)',
          color: 'var(--sapTextColor)',
          fontFamily: "'72', sans-serif",
        }}
        aria-label={title}
      >
        {children}
      </section>
    </aside>
  );

  return createPortal(drawerContent, document.body);
}
