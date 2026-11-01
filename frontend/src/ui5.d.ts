import type * as React from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'ui5-card': React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLElement>,
  HTMLElement
>;
      'ui5-badge': React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  'color-scheme'?: string;
};
      'ui5-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        design?: string;
        disabled?: boolean;
        submit?: boolean;
        icon?: string;
        value?: string;
      };
      'ui5-input': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        value?: string;
        placeholder?: string;
        disabled?: boolean;
        readonly?: boolean;
        required?: boolean;
        type?: string;
        name?: string;
        maxlength?: number;
        minlength?: number;
        'value-state'?: string;
      };
      'ui5-textarea': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        value?: string;
        placeholder?: string;
        disabled?: boolean;
        readonly?: boolean;
        required?: boolean;
        rows?: number;
        maxlength?: number;
        'value-state'?: string;
      };
     'ui5-select': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
  value?: string;
  disabled?: boolean;
  required?: boolean;
  'value-state'?: string;
};
      'ui5-option': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        value?: string;
        selected?: boolean;
      };
    }
  }
}
