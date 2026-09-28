'use client';

interface TabItem {
  key: string;
  label: string;
}

// شريط تابات موحّد بنفس شكل التابات المستخدم بالفعل في /admin و/admin/users،
// عشان نوحّد الـstyle بدل ما كل صفحة تعمل نفس الأزرار يدويًا من جديد.
export default function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition ${
            active === tab.key
              ? 'bg-[var(--c-teal-700)] text-white'
              : 'bg-[var(--c-surface)] text-[var(--c-text)] hover:bg-[var(--c-surface-muted)]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
