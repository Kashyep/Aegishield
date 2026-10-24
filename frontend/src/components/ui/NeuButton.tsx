import { forwardRef } from 'react';

interface NeuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  iconOnly?: boolean;
}

export const NeuButton = forwardRef<HTMLButtonElement, NeuButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, iconOnly = false, className = '', children, disabled, ...props }, ref) => {
    const variantClasses = {
      primary: 'neu-btn neu-btn-primary',
      secondary: 'neu-btn neu-btn-secondary',
      ghost: 'neu-btn neu-btn-ghost',
      danger: 'neu-btn neu-btn-primary', // styled via inline style
    };

    const sizeClasses = {
      sm: 'neu-btn-sm',
      md: '',
      lg: 'neu-btn-lg',
    };

    const iconClass = iconOnly ? 'neu-btn-icon' : '';

    return (
      <button
        ref={ref}
        className={`${variantClasses[variant]} ${sizeClasses[size]} ${iconClass} ${className}`}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <svg aria-hidden="true" className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite', marginRight: 'var(--space-2)' }}>
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

NeuButton.displayName = 'NeuButton';