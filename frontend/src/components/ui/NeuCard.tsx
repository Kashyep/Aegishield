import { forwardRef } from 'react';

interface NeuCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'raised' | 'raised-lg' | 'pressed' | 'subtle' | 'inset' | 'interactive';
  as?: React.ElementType;
}

export const NeuCard = forwardRef<HTMLDivElement, NeuCardProps>(
  ({ variant = 'raised', as: Component = 'div', className = '', children, style, ...props }, ref) => {
    const variantClasses = {
      raised: 'neu-card raised',
      'raised-lg': 'neu-card raised-lg',
      pressed: 'neu-card pressed',
      subtle: 'neu-card subtle',
      inset: 'neu-card inset',
      interactive: 'neu-card interactive raised',
    };

    return (
      <Component
        ref={ref}
        className={`${variantClasses[variant]} ${className}`}
        style={style}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

NeuCard.displayName = 'NeuCard';