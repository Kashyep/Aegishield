import { forwardRef } from 'react';

interface NeuInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const NeuInput = forwardRef<HTMLInputElement, NeuInputProps>(
  ({ label, hint, error, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="neu-field" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        {label && (
          <label htmlFor={inputId} className="neu-label">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`neu-input ${error ? 'neu-input-error' : ''} ${className}`}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="neu-hint" style={{ color: 'var(--color-error)' }}>
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="neu-hint">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

NeuInput.displayName = 'NeuInput';

interface NeuTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const NeuTextarea = forwardRef<HTMLTextAreaElement, NeuTextareaProps>(
  ({ label, hint, error, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="neu-field" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        {label && (
          <label htmlFor={inputId} className="neu-label">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={`neu-input neu-textarea ${error ? 'neu-input-error' : ''} ${className}`}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="neu-hint" style={{ color: 'var(--color-error)' }}>
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="neu-hint">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

NeuTextarea.displayName = 'NeuTextarea';

interface NeuSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const NeuSelect = forwardRef<HTMLSelectElement, NeuSelectProps>(
  ({ label, hint, error, options, className = '', id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="neu-field" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        {label && (
          <label htmlFor={selectId} className="neu-label">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`neu-input neu-select ${error ? 'neu-input-error' : ''} ${className}`}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={`${selectId}-error`} className="neu-hint" style={{ color: 'var(--color-error)' }}>
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${selectId}-hint`} className="neu-hint">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

NeuSelect.displayName = 'NeuSelect';