import type * as React from 'react';
import '@ui5/webcomponents/dist/Title.js';

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode; // Action buttons
  className?: string;
  level?: 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6';
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  children,
  className = '',
  level = 'H1',
}: PageHeaderProps) {
  return (
    <header className={`page-header ${className}`} style={{ marginBottom: 'var(--space-section)' }}>
      <div className="page-header-content">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <ui5-title level={level} size={level} style={{ fontWeight: 700 }}>
          {title}
        </ui5-title>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {children && <div className="page-header-actions" role="group" aria-label="Page actions">{children}</div>}
    </header>
  );
}