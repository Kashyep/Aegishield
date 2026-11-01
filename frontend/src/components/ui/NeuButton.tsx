
import type { HTMLAttributes } from 'react';

interface NeuButtonProps extends HTMLAttributes<HTMLElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  iconOnly?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

const designs = {
  primary: 'Emphasized',
  secondary: 'Default',
  ghost: 'Transparent',
  danger: 'Negative',
} as const;

export function NeuButton({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className,
  size: _size,
  iconOnly: _iconOnly,
  type = 'button',
  'aria-label': ariaLabel,
  title,
  ...props
}: NeuButtonProps) {
  void _size;
  void _iconOnly;

  return (
    <ui5-button
      design={designs[variant]}
      disabled={disabled || loading}
      submit={type === 'submit'}
      accessibleName={ariaLabel || title || undefined}
      title={title}
      aria-busy={loading || undefined}
      className={className}
      {...props}
    >
      {children}
    </ui5-button>
  );
}
