import type { ComponentChildren, JSX } from 'preact';

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

type ButtonProps = JSX.IntrinsicElements['button'] & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'default' | 'compact';
  fullWidth?: boolean;
};

export function Button({
  variant = 'secondary',
  size = 'default',
  fullWidth = false,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'dg-button',
        `dg-button--${variant}`,
        size === 'compact' && 'dg-button--compact',
        fullWidth && 'dg-button--full',
        className as string,
      )}
      {...props}
    />
  );
}

export function IconButton({ className, ...props }: ButtonProps) {
  return <Button className={cx('dg-icon-button', className as string)} size="compact" {...props} />;
}

export function Section({ title, children }: { title: string; children: ComponentChildren }) {
  const id = `section-${title.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <section className="dg-section" aria-labelledby={id}>
      <h2 className="dg-section__title" id={id}>{title}</h2>
      {children}
    </section>
  );
}

export function Field({
  id,
  label,
  description,
  children,
}: {
  id: string;
  label: string;
  description?: ComponentChildren;
  children: ComponentChildren;
}) {
  return (
    <div className="dg-field">
      <label className="dg-label" htmlFor={id}>{label}</label>
      {children}
      {description && <p className="dg-help" id={`${id}-description`}>{description}</p>}
    </div>
  );
}

type SelectFieldProps = JSX.IntrinsicElements['select'] & {
  id: string;
  label: string;
  description?: ComponentChildren;
  compact?: boolean;
};

export function SelectField({
  id,
  label,
  description,
  compact = false,
  children,
  className,
  ...props
}: SelectFieldProps) {
  return (
    <Field id={id} label={label} description={description}>
      <select
        id={id}
        className={cx('dg-input', compact && 'dg-input--compact', className as string)}
        aria-describedby={description ? `${id}-description` : undefined}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
}

type TextInputFieldProps = JSX.IntrinsicElements['input'] & {
  id: string;
  label: string;
  description?: ComponentChildren;
};

export function TextInputField({
  id,
  label,
  description,
  className,
  ...props
}: TextInputFieldProps) {
  return (
    <Field id={id} label={label} description={description}>
      <input
        id={id}
        className={cx('dg-input', className as string)}
        aria-describedby={description ? `${id}-description` : undefined}
        {...props}
      />
    </Field>
  );
}

export function ToggleRow({
  id,
  label,
  checked,
  onChange,
  description,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  description?: ComponentChildren;
}) {
  return (
    <div>
      <label className="dg-toggle-row" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          aria-describedby={description ? `${id}-description` : undefined}
          onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
        />
        <span>
          {label}
          {description && <span className="dg-help" id={`${id}-description`}>{description}</span>}
        </span>
      </label>
    </div>
  );
}

export function StatusMessage({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'error' | 'success';
  children: ComponentChildren;
}) {
  return (
    <div
      className={cx('dg-status', tone === 'error' && 'dg-status--error', tone === 'success' && 'dg-status--success')}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      {children}
    </div>
  );
}
