
interface MetricCardProps {
  label: string;
  value: string | number;
  note?: string;
  variant?: 'default' | 'success' | 'warning';
  className?: string;
}

export function MetricCard({
  label,
  value,
  note,
  variant = 'default',
  className = '',
}: MetricCardProps) {
  const valueColor =
    variant === 'success'
      ? 'var(--sapPositiveColor)'
      : variant === 'warning'
        ? 'var(--sapCriticalColor)'
        : 'var(--sapTextColor)';

  return (
    <ui5-card
      className={className}
      style={{
        width: '100%',
        minHeight: '140px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '20px',
        }}
      >
        <dl style={{ margin: 0 }}>
          <dt className="metric-label">{label}</dt>
          <dd style={{ margin: 0 }}>
            <strong
              style={{
                fontSize: '2rem',
                fontWeight: 700,
                color: valueColor,
              }}
            >
              {value}
            </strong>
          </dd>
          {note && (
            <dd className="metric-note" style={{ margin: 0 }}>
              {note}
            </dd>
          )}
        </dl>
      </div>
    </ui5-card>
  );
}
