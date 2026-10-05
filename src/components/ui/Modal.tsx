export default function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
}) {
  if (!open) return null;
  const maxWidthClass = size === 'xl' ? 'max-w-3xl' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg';
  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
      <div className={`bg-[var(--c-surface)] rounded-2xl p-6 ${maxWidthClass} w-full max-h-[92vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-extrabold text-[var(--c-teal-900)] text-lg">{title}</h2>
          <button
            onClick={onClose}
            className="text-[var(--c-text-muted)] hover:text-[var(--c-text)] text-xl leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
