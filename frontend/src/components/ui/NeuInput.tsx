import type * as React from 'react';
import { forwardRef } from 'react';

interface NeuInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  showClearIcon?: boolean;
}

export const NeuInput = forwardRef<HTMLInputElement, NeuInputProps>(
  ({ label, hint, error, showClearIcon, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="ae-field">
        {label && (
          <label htmlFor={inputId} className="ae-label">
            {label}
          </label>
        )}

        <ui5-input
          ref={ref as React.Ref<HTMLElement>}
          id={inputId}
          className={className}
          value={(props.value as string) ?? (props.defaultValue as string) ?? ''}
          placeholder={props.placeholder}
          disabled={props.disabled}
          readonly={props.readOnly}
          required={props.required}
          type={props.type as 'Text' | 'Email' | 'Number' | 'Password' | 'Tel' | 'URL' | 'Search' | undefined}
          name={props.name}
          maxlength={props.maxLength}
          showClearIcon={showClearIcon}
          valueState={error ? 'Negative' : 'None'}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          onInput={(event: React.FormEvent<HTMLElement>) => props.onChange?.(event as unknown as React.ChangeEvent<HTMLInputElement>)}
        />

        {error && <p id={`${inputId}-error`} className="ae-hint" style={{ color: 'var(--sapNegativeColor)' }}>{error}</p>}
        {hint && !error && <p id={`${inputId}-hint`} className="ae-hint">{hint}</p>}
      </div>
    );
  }
);

NeuInput.displayName = 'NeuInput';

interface NeuTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  growing?: boolean;
  growingMaxRows?: number;
}

export const NeuTextarea = forwardRef<HTMLTextAreaElement, NeuTextareaProps>(
  ({ label, hint, error, growing, growingMaxRows, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="ae-field">
        {label && (
          <label htmlFor={inputId} className="ae-label">
            {label}
          </label>
        )}

        <ui5-textarea
          ref={ref as React.Ref<HTMLElement>}
          id={inputId}
          className={className}
          value={(props.value as string) ?? (props.defaultValue as string) ?? ''}
          placeholder={props.placeholder}
          disabled={props.disabled}
          readonly={props.readOnly}
          required={props.required}
          rows={props.rows}
          maxlength={props.maxLength}
          growing={growing}
          growingMaxRows={growingMaxRows}
          valueState={error ? 'Negative' : 'None'}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          onInput={(event: React.FormEvent<HTMLElement>) => props.onChange?.(event as unknown as React.ChangeEvent<HTMLTextAreaElement>)}
        />

        {error && <p id={`${inputId}-error`} className="ae-hint" style={{ color: 'var(--sapNegativeColor)' }}>{error}</p>}
        {hint && !error && <p id={`${inputId}-hint`} className="ae-hint">{hint}</p>}
      </div>
    );
  }
);

NeuTextarea.displayName = 'NeuTextarea';

interface NeuSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const NeuSelect = forwardRef<HTMLSelectElement, NeuSelectProps>(
  ({ label, hint, error, options, className = '', id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="ae-field">
        {label && (
          <label htmlFor={selectId} className="ae-label">
            {label}
          </label>
        )}

        <ui5-select
          ref={ref as React.Ref<HTMLElement>}
          id={selectId}
          className={className}
          disabled={props.disabled}
          required={props.required}
          valueState={error ? 'Negative' : 'None'}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
          onChange={(event: React.FormEvent<HTMLElement>) => props.onChange?.(event as unknown as React.ChangeEvent<HTMLSelectElement>)}
        >
          {options.map((opt) => (
            <ui5-option key={opt.value} value={opt.value} selected={opt.value === (props.value ?? props.defaultValue)}>
              {opt.label}
            </ui5-option>
          ))}
        </ui5-select>

        {error && <p id={`${selectId}-error`} className="ae-hint" style={{ color: 'var(--sapNegativeColor)' }}>{error}</p>}
        {hint && !error && <p id={`${selectId}-hint`} className="ae-hint">{hint}</p>}
      </div>
    );
  }
);

NeuSelect.displayName = 'NeuSelect';
