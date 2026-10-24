import { NeuCard } from '../ui';

interface MetricCardProps {
  label: string;
  value: string | number;
  note?: string;
  variant?: 'default' | 'success' | 'warning';
  className?: string;
}

export function MetricCard({ label, value, note, variant = 'default', className = '' }: MetricCardProps) {
  const valueColor = variant === 'success' ? 'var(--color-success)' : variant === 'warning' ? 'var(--color-warning)' : 'var(--color-text)';

  return (
    <NeuCard variant="raised" className={className} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-5)' }}>
      <dl style={{ margin: 0 }}>
        <dt className="metric-label">{label}</dt>
        <dd style={{ margin: 0 }}>
          <strong style={{ fontSize: 'var(--text-2xl)', letterSpacing: 'var(--tracking-tight)', fontFamily: 'var(--font-heading)', color: valueColor }}>
            {value}
          </strong>
        </dd>
        {note && <dd className="metric-note" style={{ margin: 0 }}>{note}</dd>}
      </dl>
    </NeuCard>
  );
}