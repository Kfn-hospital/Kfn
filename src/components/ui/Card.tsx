export default function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-[var(--c-surface)] rounded-2xl shadow p-5 ${className}`}>
      {children}
    </div>
  );
}
