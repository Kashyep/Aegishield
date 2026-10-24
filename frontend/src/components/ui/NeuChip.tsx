interface NeuChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'accent' | 'neutral';
  size?: 'sm' | 'md';
  dot?: boolean;
  dotColor?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

export function NeuChip({ variant = 'neutral', size = 'md', dot, dotColor, className = '', children, ...props }: NeuChipProps) {
  const variantClasses = {
    primary: 'neu-chip neu-chip-primary',
    success: 'neu-chip neu-chip-success',
    warning: 'neu-chip neu-chip-warning',
    error: 'neu-chip neu-chip-error',
    info: 'neu-chip neu-chip-info',
    accent: 'neu-chip neu-chip-accent',
    neutral: 'neu-chip neu-chip-neutral',
  };

  const sizeStyles = {
    sm: { padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-xs)' },
    md: { padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-xs)' },
  };

  return (
    <span
      className={`${variantClasses[variant]} ${className}`}
      style={{ ...sizeStyles[size] }}
      {...props}
    >
      {dot && <span className={`neu-badge-dot ${dotColor || variant}`} aria-hidden="true" />}
      {children}
    </span>
  );
}

interface NeuPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: React.ReactNode;
}

export function NeuPill({ active = false, icon, className = '', children, ...props }: NeuPillProps) {
  return (
    <button
      className={`neu-pill ${active ? 'active' : ''} ${className}`}
      aria-selected={active}
      {...props}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
}

interface NeuPillsProps {
  tabs: { id: string; label: string; icon?: React.ReactNode; count?: number }[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  'aria-label'?: string;
}

export function NeuPills({ tabs, activeTab, onChange, className = '', 'aria-label': ariaLabel = 'Tab navigation' }: NeuPillsProps) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={`neu-pills ${className}`} style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`${tab.id}-panel`}
          id={`${tab.id}-tab`}
          className={`neu-pill ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon && <span aria-hidden="true">{tab.icon}</span>}
          {tab.label}
          {tab.count !== undefined && (
            <span style={{ marginLeft: 'var(--space-1)', opacity: 0.7 }}>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

interface NeuBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  dot?: boolean;
}

export function NeuBadge({ variant = 'neutral', dot = false, className = '', children, ...props }: NeuBadgeProps) {
  const variantClasses = {
    success: 'neu-badge neu-badge-dot success',
    warning: 'neu-badge neu-badge-dot warning',
    error: 'neu-badge neu-badge-dot error',
    info: 'neu-badge neu-badge-dot info',
    neutral: 'neu-badge neu-badge-dot neutral',
  };

  return (
    <span className={`${variantClasses[variant]} ${className}`} {...props}>
      {dot && <span className="neu-badge-dot" style={{ backgroundColor: 'currentColor' }} aria-hidden="true" />}
      {children}
    </span>
  );
}