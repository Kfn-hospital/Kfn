export default function EmptyState({
  icon = '📭',
  message,
  action,
}: {
  icon?: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-10">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-[var(--c-text-muted)]">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
