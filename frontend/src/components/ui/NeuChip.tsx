import type * as React from 'react';

type ChipVariant = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'accent' | 'neutral';
type TagDesign = 'Set1' | 'Set2' | 'Neutral' | 'Information' | 'Positive' | 'Negative' | 'Critical';

const variantToDesign: Record<ChipVariant, TagDesign> = {
  success: 'Positive',
  error: 'Negative',
  warning: 'Critical',
  info: 'Information',
  neutral: 'Neutral',
  primary: 'Information',
  accent: 'Information',
};

interface NeuChipProps extends React.HTMLAttributes<HTMLElement> {
  variant?: ChipVariant;
  design?: TagDesign;
  size?: 'sm' | 'md' | 'S' | 'L';
  dot?: boolean;
  dotColor?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

export function NeuChip({
  variant = 'neutral',
  design,
  dot,
  size,
  className = '',
  children,
  ...props
}: NeuChipProps) {
  const resolvedDesign = design ?? variantToDesign[variant] ?? 'Neutral';
  const tagSize = size === 'sm' || size === 'S' ? 'S' : undefined;

  return (
    <ui5-tag
      design={resolvedDesign}
      size={tagSize}
      className={className}
      {...props}
    >
      {dot && <span aria-hidden="true">● </span>}
      {children}
    </ui5-tag>
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
      className={`ae-pill ${active ? 'active' : ''} ${className}`}
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
      className={`ae-pills ${className}`}
      style={{
        display: 'flex',
        gap: 'var(--space-1)',
        padding: 'var(--space-1)',
        background: 'var(--sapGroup_ContentBackground)',
        borderRadius: 'var(--radius-full)',
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          id={`${tab.id}-tab`}
          className={`ae-pill ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon && <span aria-hidden="true">{tab.icon}</span>}
          <span>{tab.label}</span>
          {typeof tab.count === 'number' && (
            <span
              style={{
                marginLeft: 'var(--space-1)',
                padding: '0 var(--space-2)',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--text-xs)',
                background: activeTab === tab.id ? 'rgba(255,255,255,0.2)' : 'var(--sapGroup_ContentBackground)',
              }}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

interface NeuBadgeProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | ChipVariant;
  design?: TagDesign;
  dot?: boolean;
}

export function NeuBadge({
  variant = 'neutral',
  design,
  dot = false,
  className = '',
  children,
  ...props
}: NeuBadgeProps) {
  const resolvedDesign = design ?? variantToDesign[variant as ChipVariant] ?? 'Neutral';

  return (
    <ui5-tag
      design={resolvedDesign}
      className={className}
      {...props}
    >
      {dot && <span aria-hidden="true">● </span>}
      {children}
    </ui5-tag>
  );
}
