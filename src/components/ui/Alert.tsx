export default function Alert({
  type,
  message,
}: {
  type: 'success' | 'error';
  message: string;
}) {
  if (!message) return null;
  return (
    <p
      className={`text-sm font-bold rounded-lg px-3 py-2 ${
        type === 'success'
          ? 'text-green-700 bg-green-50'
          : 'text-red-700 bg-red-50'
      }`}
    >
      {message}
    </p>
  );
}
