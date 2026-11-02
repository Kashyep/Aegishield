
interface NeuChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'accent' | 'neutral';
  size?: 'sm' | 'md';
  dot?: boolean;
  dotColor?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

const chipColors = {
  primary: '8',
  success: '8',
  warning: '5',
  error: '1',
  info: '6',
  accent: '7',
  neutral: '9',
};

export function NeuChip({
  variant = 'neutral',
  dot,
  className = '',
  children,
  ...props
}: NeuChipProps) {
  return (
    <ui5-badge color-scheme={chipColors[variant]} className={className} {...props}>
      {dot && <span aria-hidden="true">● </span>}
      {children}
    </ui5-badge>
  );
}

interface NeuPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: React.ReactNode;
}

export function NeuPill({
  active = false,
  icon,
  className = '',
  children,
  ...props
}: NeuPillProps) {
  return (
    <button
      className={`neu-pill ${active ? 'active' : ''} ${className}`}
      aria-pressed={active}
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

export function NeuPills({
  tabs,
  activeTab,
  onChange,
  className = '',
  'aria-label': ariaLabel = 'Tab navigation',
}: NeuPillsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`neu-pills ${className}`}
      style={{
        display: 'flex',
        gap: 'var(--space-1)',
        flexWrap: 'wrap',
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: 'var(--space-2)',
        marginBottom: 'var(--space-3)',
      }}
    >
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
            <span style={{ marginLeft: 'var(--space-1)', opacity: 0.7 }}>
              {tab.count}
            </span>
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

export function NeuBadge({
  variant = 'neutral',
  dot = false,
  className = '',
  children,
  ...props
}: NeuBadgeProps) {
  return (
    <ui5-badge color-scheme={chipColors[variant]} className={className} {...props}>
      {dot && <span aria-hidden="true">● </span>}
      {children}
    </ui5-badge>
  );
}
