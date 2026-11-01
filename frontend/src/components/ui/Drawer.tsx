import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
  className?: string;
}

export function Drawer({ isOpen, onClose, title, children, width, className = '' }: DrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    drawerRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;

      const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]'
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
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      const trigger = previouslyFocused.current;

if (trigger?.isConnected) {
  requestAnimationFrame(() => {
    if (trigger.isConnected) {
      trigger.focus();
    }
  });
}
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const drawerContent = (
    <div className="neu-drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        ref={drawerRef}
        className={`neu-drawer ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        tabIndex={-1}
        style={{ width: width || 'var(--drawer-width)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="neu-dialog-header">
          <div>
            <p className="eyebrow" style={{ marginBottom: 'var(--space-1)' }}>EVALUATION EVIDENCE</p>
            <h2 id="drawer-title">{title}</h2>
          </div>
          <button className="neu-dialog-close" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>
        <section style={{ paddingTop: 'var(--space-2)' }} aria-label={title}>
          {children}
        </section>
      </aside>
    </div>
  );

  return createPortal(drawerContent, document.body);
}