import { forwardRef } from 'react';

interface NeuCardProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'raised' | 'raised-lg' | 'pressed' | 'subtle' | 'inset' | 'interactive' | string;
  as?: React.ElementType;
  title?: string;
  subtitle?: string;
  titleText?: string;
  subtitleText?: string;
}

export const NeuCard = forwardRef<HTMLElement, NeuCardProps>(
  ({ variant = 'raised', as: _as, title, subtitle, titleText, subtitleText, className = '', children, style, role, ...props }, ref) => {
    const computedRole = role || (_as === 'section' ? 'region' : (_as === 'article' ? 'article' : undefined));
    const finalTitle = titleText ?? title;
    const finalSubtitle = subtitleText ?? subtitle;
    const hasHeader = Boolean(finalTitle || finalSubtitle);

    const cardClasses = ['ae-card', variant === 'interactive' ? 'interactive' : '', className]
      .filter(Boolean)
      .join(' ');

    // Padding is applied to an inner body wrapper, not the ui5-card host, so
    // the content sits inside the card's single native border.
    const { padding, ...hostStyle } = style ?? {};

    return (
      <ui5-card
        ref={ref}
        className={cardClasses}
        style={hostStyle}
        role={computedRole}
        {...props}
      >
        {hasHeader && (
          <ui5-card-header
            slot="header"
            titleText={finalTitle}
            subtitleText={finalSubtitle}
          />
        )}
        <div className="ae-card-body" style={{ padding: padding ?? 'var(--space-4)' }}>
          {children}
        </div>
      </ui5-card>
    );
  }
);

NeuCard.displayName = 'NeuCard';
