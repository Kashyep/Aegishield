
import { forwardRef } from 'react';

interface NeuInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
}

export const NeuInput = forwardRef<HTMLInputElement, NeuInputProps>(
  ({ label, hint, error, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="neu-field">
        {label && (
          <label htmlFor={inputId} className="neu-label">
            {label}
          </label>
        )}

        <ui5-input
          ref={ref as React.Ref<HTMLElement>}
          id={inputId}
          className={className}
          value={props.value as string ?? props.defaultValue as string ?? ''}
          placeholder={props.placeholder}
          disabled={props.disabled}
          readonly={props.readOnly}
          required={props.required}
          type={props.type}
          name={props.name}
          maxlength={props.maxLength}
          minlength={props.minLength}
          value-state={error ? 'Negative' : 'None'}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          onInput={(event) => props.onChange?.(event as unknown as React.ChangeEvent<HTMLInputElement>)}
        />

        {error && <p id={`${inputId}-error`} className="neu-hint">{error}</p>}
        {hint && !error && <p id={`${inputId}-hint`} className="neu-hint">{hint}</p>}
      </div>
    );
  }
);

NeuInput.displayName = 'NeuInput';

interface NeuTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
}

export const NeuTextarea = forwardRef<HTMLTextAreaElement, NeuTextareaProps>(
  ({ label, hint, error, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="neu-field">
        {label && (
          <label htmlFor={inputId} className="neu-label">
            {label}
          </label>
        )}

        <ui5-textarea
          ref={ref as React.Ref<HTMLElement>}
          id={inputId}
          className={className}
          value={props.value as string ?? props.defaultValue ?? ''}
          placeholder={props.placeholder}
          disabled={props.disabled}
          readonly={props.readOnly}
          required={props.required}
          rows={props.rows}
          maxlength={props.maxLength}
          value-state={error ? 'Negative' : 'None'}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          onInput={(event) => props.onChange?.(event as unknown as React.ChangeEvent<HTMLTextAreaElement>)}
        />

        {error && <p id={`${inputId}-error`} className="neu-hint">{error}</p>}
        {hint && !error && <p id={`${inputId}-hint`} className="neu-hint">{hint}</p>}
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
      <div className="neu-field">
        {label && (
          <label htmlFor={selectId} className="neu-label">
            {label}
          </label>
        )}

        <ui5-select
          ref={ref as React.Ref<HTMLElement>}
          id={selectId}
          className={className}
          disabled={props.disabled}
          required={props.required}
          value-state={error ? 'Negative' : 'None'}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
          onChange={(event) => props.onChange?.(event as unknown as React.ChangeEvent<HTMLSelectElement>)}
        >
          {options.map((opt) => (
            <ui5-option key={opt.value} value={opt.value} selected={opt.value === (props.value ?? props.defaultValue)}>
              {opt.label}
            </ui5-option>
          ))}
        </ui5-select>

        {error && <p id={`${selectId}-error`} className="neu-hint">{error}</p>}
        {hint && !error && <p id={`${selectId}-hint`} className="neu-hint">{hint}</p>}
      </div>
    );
  }
);

NeuSelect.displayName = 'NeuSelect';
