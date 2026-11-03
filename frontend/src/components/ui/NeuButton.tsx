import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'positive';
type ButtonDesign = 'Default' | 'Positive' | 'Negative' | 'Transparent' | 'Emphasized' | 'Attention';

interface NeuButtonProps extends Omit<ButtonHTMLAttributes<HTMLElement>, 'size'> {
  variant?: ButtonVariant;
  design?: ButtonDesign;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  iconOnly?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  icon?: string;
  endIcon?: string;
  tooltip?: string;
}

const variantToDesign: Record<ButtonVariant, ButtonDesign> = {
  primary: 'Emphasized',
  secondary: 'Default',
  ghost: 'Transparent',
  danger: 'Negative',
  positive: 'Positive',
};

export function NeuButton({
  variant = 'primary',
  design,
  loading = false,
  disabled,
  children,
  className,
  size: _size,
  iconOnly: _iconOnly,
  type = 'button',
  'aria-label': ariaLabel,
  title,
  tooltip,
  icon,
  endIcon,
  ...props
}: NeuButtonProps) {
  void _size;
  void _iconOnly;

  const resolvedDesign = design ?? variantToDesign[variant] ?? 'Default';

  return (
    <ui5-button
      design={resolvedDesign}
      disabled={disabled || loading}
      submit={type === 'submit'}
      accessibleName={ariaLabel || undefined}
      title={title}
      tooltip={tooltip ?? title}
      icon={icon}
      endIcon={endIcon}
      aria-busy={loading || undefined}
      className={className}
      {...props}
    >
      {children}
    </ui5-button>
  );
}
