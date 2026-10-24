interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode; // Action buttons
  className?: string;
}

export function PageHeader({ eyebrow, title, subtitle, children, className = '' }: PageHeaderProps) {
  return (
    <header className={`page-header ${className}`} style={{ marginBottom: 'var(--space-section)' }}>
      <div className="page-header-content">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {children && <div className="page-header-actions" role="group" aria-label="Page actions">{children}</div>}
    </header>
  );
}