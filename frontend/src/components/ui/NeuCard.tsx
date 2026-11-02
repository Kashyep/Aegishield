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
  ({ variant = 'raised', as: _as, title, subtitle, titleText, subtitleText, className = '', children, style, ...props }, ref) => {
    void _as;
    const finalTitle = titleText ?? title;
    const finalSubtitle = subtitleText ?? subtitle;
    const hasHeader = Boolean(finalTitle || finalSubtitle);

    const cardClasses = ['ae-card', variant === 'interactive' ? 'interactive' : '', className]
      .filter(Boolean)
      .join(' ');

    return (
      <ui5-card
        ref={ref}
        className={cardClasses}
        style={style}
        {...props}
      >
        {hasHeader && (
          <ui5-card-header
            slot="header"
            titleText={finalTitle}
            subtitleText={finalSubtitle}
          />
        )}
        {children}
      </ui5-card>
    );
  }
);

NeuCard.displayName = 'NeuCard';
