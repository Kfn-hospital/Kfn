interface FormFieldProps {
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'time' | 'textarea';
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  name?: string;
  autoComplete?: string;
}

export default function FormField({
  label,
  type = 'text',
  value,
  onChange,
  required = false,
  placeholder,
  name,
  autoComplete,
}: FormFieldProps) {
  return (
    <div>
      <label className="text-sm font-bold text-[var(--c-text)] mb-1 block">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          rows={3}
          name={name}
          autoComplete={autoComplete}
          className="w-full border rounded-xl px-3 py-2.5"
        />
      ) : (
        <input
          type={type}
          name={name}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          className="w-full border rounded-xl px-3 py-2.5"
        />
      )}
    </div>
  );
}
