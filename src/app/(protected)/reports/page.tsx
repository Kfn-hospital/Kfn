'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

type BookingRow = {
  id: string;
  booking_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  rooms: { name: string; name_en: string | null } | null;
};

type RequestRow = {
  id: string;
  status: string;
  category_id: string | null;
  request_categories: { name: string; name_en: string | null } | null;
};

const COLORS = ['#0f766e', '#f59e0b', '#ef4444', '#64748b', '#3b82f6', '#a855f7'];

export default function ReportsPage() {
const { t, lang: language } = useLanguage();
  const supabase = createClient();

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: r }] = await Promise.all([
        supabase.from('bookings').select('id, booking_date, status, rooms(name, name_en)'),
        supabase.from('requests').select('id, status, category_id, request_categories(name, name_en)'),
      ]);
      if (b) setBookings(b as unknown as BookingRow[]);
      if (r) setRequests(r as unknown as RequestRow[]);
      setLoading(false);
    })();
  }, [supabase]);

  const statusCounts = useMemo(() => {
    const counts = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    bookings.forEach((b) => { counts[b.status] = (counts[b.status] ?? 0) + 1; });
    return [
      { name: t('bookingPending'), value: counts.pending },
      { name: t('bookingApproved'), value: counts.approved },
      { name: t('bookingRejected'), value: counts.rejected },
      { name: t('bookingCancelled'), value: counts.cancelled },
    ];
  }, [bookings, t]);

  const monthlyTrend = useMemo(() => {
    const map = new Map<string, number>();
    bookings.forEach((b) => {
      const month = b.booking_date?.slice(0, 7) ?? 'unknown';
      map.set(month, (map.get(month) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));
  }, [bookings]);

  const topRooms = useMemo(() => {
    const map = new Map<string, number>();
    bookings.forEach((b) => {
      const name = (language === 'ar' ? b.rooms?.name : b.rooms?.name_en || b.rooms?.name) ?? '—';
      map.set(name, (map.get(name) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [bookings, language]);

  const requestsByCategory = useMemo(() => {
    const map = new Map<string, number>();
    requests.forEach((r) => {
      const name = (language === 'ar' ? r.request_categories?.name : r.request_categories?.name_en || r.request_categories?.name) ?? t('uncategorized');
      map.set(name, (map.get(name) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [requests, language, t]);

  const exportCsv = () => {
    const rows = bookings.map((b) => ({
      id: b.id,
      room: language === 'ar' ? b.rooms?.name : b.rooms?.name_en || b.rooms?.name,
      date: b.booking_date,
      status: b.status,
    }));
    const header = Object.keys(rows[0] ?? { id: '', room: '', date: '', status: '' }).join(',');
    const body = rows.map((r) => Object.values(r).map((v) => `"${v ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([`﻿${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="text-slate-400">{t('loading')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-teal-900">📊 {t('reportsTitle')}</h1>
          <p className="text-slate-500">{t('reportsSubtitle')}</p>
        </div>
        <button
          onClick={exportCsv}
          className="bg-teal-700 text-white font-bold rounded-xl px-4 py-2"
        >
          ⬇ {t('exportCsv')}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statusCounts.map((s, i) => (
          <Card key={s.name}>
            <p className="text-sm text-slate-500">{s.name}</p>
            <p className="text-3xl font-extrabold" style={{ color: COLORS[i] }}>{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-bold text-teal-900 mb-3">{t('bookingsByMonth')}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#0f766e" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="font-bold text-teal-900 mb-3">{t('topRooms')}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topRooms} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} fontSize={12} />
              <YAxis type="category" dataKey="name" width={110} fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#0f766e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="font-bold text-teal-900 mb-3">{t('requestsByCategory')}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={requestsByCategory} dataKey="value" nameKey="name" outerRadius={90} label>
                {requestsByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="font-bold text-teal-900 mb-3">{t('bookingStatusBreakdown')}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={statusCounts} dataKey="value" nameKey="name" outerRadius={90} label>
                {statusCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
