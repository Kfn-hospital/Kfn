'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface Column<T> {
  header: string;
  render: (row: T) => React.ReactNode;
}

const DEFAULT_PAGE_SIZE = 15;

export default function DataTable<T extends { id: string }>({
  columns,
  rows,
  emptyMessage,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  columns: Column<T>[];
  rows: T[];
  emptyMessage: string;
  pageSize?: number;
}) {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  // لو الفلتر/البحث غيّر عدد الصفوف وبقت الصفحة الحالية مش موجودة، نرجع لأول صفحة
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  if (!rows.length) {
    return <p className="text-[var(--c-text-muted)] text-center py-10">{emptyMessage}</p>;
  }

  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[var(--c-text-muted)] border-b">
              {columns.map((col, i) => (
                <th key={i} className="p-2 text-start font-bold">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                {columns.map((col, i) => (
                  <td key={i} className="p-2">
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-[var(--c-text-muted)]">
          <span>
            {start + 1}–{Math.min(start + pageSize, rows.length)} {t('paginationOfLabel')} {rows.length}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded-lg border border-[var(--c-teal-100)] font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--c-teal-50)]"
            >
              {t('paginationPrev')}
            </button>
            <span className="font-bold">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded-lg border border-[var(--c-teal-100)] font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--c-teal-50)]"
            >
              {t('paginationNext')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
