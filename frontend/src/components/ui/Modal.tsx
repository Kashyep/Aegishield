import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: string;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, actions, maxWidth, className = '' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (active === dialogRef.current || !dialogRef.current.contains(active)) {
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

  const modalContent = (
    <div className="neu-backdrop" onClick={onClose} role="presentation">
      <section
        ref={dialogRef}
        className={`neu-modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        style={{ maxWidth: maxWidth || 'var(--modal-max-width)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="neu-dialog-header">
          <div>
            <h2 id="modal-title">{title}</h2>
          </div>
          <button className="neu-dialog-close" onClick={onClose} aria-label="Close dialog">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>
        <section aria-label={title}>{children}</section>
        {actions && <footer className="neu-dialog-actions">{actions}</footer>}
      </section>
    </div>
  );

  return createPortal(modalContent, document.body);
}

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="400px"
    >
      <p className="approval-note" style={{ marginBottom: 'var(--space-4)' }}>{message}</p>
      <div className="neu-dialog-actions">
        <button className="neu-btn neu-btn-secondary" onClick={onClose} disabled={isLoading}>
          {cancelLabel}
        </button>
        <button
          className={`neu-btn ${variant === 'danger' ? 'neu-btn-primary' : 'neu-btn-primary'}`}
          onClick={() => { onConfirm(); onClose(); }}
          disabled={isLoading}
          style={variant === 'danger' ? { background: 'var(--color-error)', borderColor: 'var(--color-error)' } : {}}
        >
          {isLoading ? 'Processing…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}