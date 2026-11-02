import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import '@ui5/webcomponents/dist/Dialog.js';
import '@ui5/webcomponents/dist/Bar.js';
import '@ui5/webcomponents/dist/Button.js';
import '@ui5/webcomponents/dist/DatePicker.js';
import '@ui5/webcomponents/dist/Title.js';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: string;
  className?: string;
  restoreFocusTo?: HTMLElement | null;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  actions,
  maxWidth,
  restoreFocusTo,
  className = '',
}: ModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const isClosingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      isClosingRef.current = false;
      previouslyFocused.current = restoreFocusTo ?? (document.activeElement as HTMLElement);
    }
  }, [isOpen, restoreFocusTo]);

  const handleClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const trigger = restoreFocusTo ?? previouslyFocused.current;
      if (trigger?.isConnected) {
        requestAnimationFrame(() => {
          if (trigger.isConnected) {
            trigger.focus();
          }
        });
      }
    };
  }, [isOpen, handleClose, restoreFocusTo]);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onUi5Close = () => {
      handleClose();
    };

    dialog.addEventListener('close', onUi5Close);
    return () => {
      dialog.removeEventListener('close', onUi5Close);
    };
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const modalContent = (
    <ui5-dialog
      ref={dialogRef}
      open={true}
      headerText={title}
      accessibleName={title}
      accessibleRole="Dialog"
      className={`ae-modal neu-modal ${className}`}
      style={{
        maxWidth: maxWidth || 'var(--modal-max-width, 680px)',
        width: '92vw',
      }}
      onclose={handleClose}
    >
      <div
        className="ae-dialog-content"
        style={{
          padding: 'var(--space-2) var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          color: 'var(--sapTextColor)',
          fontFamily: "'72', sans-serif",
        }}
      >
        {children}
      </div>
      {actions && (
        <ui5-bar slot="footer" design="Footer">
          <div
            slot="endContent"
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              alignItems: 'center',
            }}
          >
            {actions}
          </div>
        </ui5-bar>
      )}
    </ui5-dialog>
  );

  return createPortal(modalContent, document.body);
}

export interface ConfirmDialogProps {
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
  const confirmDesign = variant === 'danger' ? 'Negative' : 'Emphasized';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="420px"
      actions={
        <>
          <ui5-button
            design="Transparent"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </ui5-button>
          <ui5-button
            design={confirmDesign}
            onClick={() => {
              onConfirm();
              onClose();
            }}
            disabled={isLoading}
          >
            {isLoading ? 'Processing…' : confirmLabel}
          </ui5-button>
        </>
      }
    >
      <p
        className="approval-note"
        style={{
          margin: 'var(--space-2) 0',
          color: 'var(--sapTextColor)',
          fontSize: 'var(--text-sm)',
          lineHeight: 'var(--leading-relaxed)',
        }}
      >
        {message}
      </p>
    </Modal>
  );
}
