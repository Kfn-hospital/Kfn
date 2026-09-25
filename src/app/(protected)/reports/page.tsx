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
  request_categories: { name: string } | null;
};

type AssigneeStatRow = {
  user_id: string;
  status: string;
  profiles: { name: string } | null;
};

const COLORS = ['#0f766e', '#f59e0b', '#ef4444', '#64748b', '#3b82f6', '#a855f7'];
const REQUEST_STATUS_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'];

export default function ReportsPage() {
  const { t, lang: language } = useLanguage();
  const supabase = createClient();

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [assigneeRows, setAssigneeRows] = useState<AssigneeStatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPersonalView, setIsPersonalView] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let role: string | null = null;
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        role = profile?.role ?? null;
      }

      const personal = role === 'employee';
      setIsPersonalView(personal);

      let bookingsQuery = supabase.from('bookings').select('id, booking_date, status, rooms(name, name_en)');
      let requestsQuery = supabase.from('requests').select('id, status, category_id, request_categories(name)');

      if (personal && user) {
        bookingsQuery = bookingsQuery.eq('booked_by', user.id);
        requestsQuery = requestsQuery.eq('created_by', user.id);
      }

      const assigneesQuery = supabase.from('request_assignees').select('user_id, status, profiles(name)');

      const [{ data: b }, { data: r }, { data: a }] = await Promise.all([
        bookingsQuery,
        requestsQuery,
        assigneesQuery,
      ]);
      if (b) setBookings(b as unknown as BookingRow[]);
      if (r) setRequests(r as unknown as RequestRow[]);
      if (a) setAssigneeRows(a as unknown as AssigneeStatRow[]);
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
      const name = r.request_categories?.name ?? t('uncategorized');
      map.set(name, (map.get(name) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [requests, t]);

  const requestStatusCounts = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, in_progress: 0, completed: 0, rejected: 0 };
    requests.forEach((r) => {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    });
    return [
      { key: 'pending', name: t('requestPending'), value: counts.pending },
      { key: 'in_progress', name: t('requestInProgress'), value: counts.in_progress },
      { key: 'completed', name: t('requestCompleted'), value: counts.completed },
      { key: 'rejected', name: t('requestRejected'), value: counts.rejected },
    ];
  }, [requests, t]);

  const requestsByAssignee = useMemo(() => {
    const map = new Map<string, { name: string; pending: number; in_progress: number; completed: number; total: number }>();
    assigneeRows.forEach((row) => {
      const name = row.profiles?.name || t('uncategorized');
      if (!map.has(row.user_id)) {
        map.set(row.user_id, { name, pending: 0, in_progress: 0, completed: 0, total: 0 });
      }
      const entry = map.get(row.user_id)!;
      entry.total += 1;
      if (row.status === 'pending') entry.pending += 1;
      else if (row.status === 'in_progress') entry.in_progress += 1;
      else if (row.status === 'completed') entry.completed += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [assigneeRows, t]);

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

  if (loading) return <p className="text-[var(--c-text-muted)]">{t('loading')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--c-teal-900)]">
            📊 {isPersonalView ? t('myStatsTitle') : t('reportsTitle')}
          </h1>
          <p className="text-[var(--c-text-muted)]">{isPersonalView ? t('myStatsSubtitle') : t('reportsSubtitle')}</p>
        </div>
        <button
          onClick={exportCsv}
          className="bg-[var(--c-teal-700)] text-white font-bold rounded-xl px-4 py-2"
        >
          ⬇ {t('exportCsv')}
        </button>
      </div>

      <div>
        <h2 className="font-bold text-[var(--c-teal-900)] mb-3">🗓️ {t('bookingStatusBreakdown')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statusCounts.map((s, i) => (
            <Card key={s.name}>
              <p className="text-sm text-[var(--c-text-muted)]">{s.name}</p>
              <p className="text-3xl font-extrabold" style={{ color: COLORS[i] }}>{s.value}</p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-bold text-[var(--c-teal-900)] mb-3">📋 {t('requestsSectionTitle')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {requestStatusCounts.map((s, i) => (
            <Card key={s.key}>
              <p className="text-sm text-[var(--c-text-muted)]">{s.name}</p>
              <p className="text-3xl font-extrabold" style={{ color: REQUEST_STATUS_COLORS[i] }}>{s.value}</p>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-bold text-[var(--c-teal-900)] mb-3">{t('bookingsByMonth')}</h3>
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
          <h3 className="font-bold text-[var(--c-teal-900)] mb-3">{t('topRooms')}</h3>
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
          <h3 className="font-bold text-[var(--c-teal-900)] mb-3">{t('requestsByCategory')}</h3>
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
          <h3 className="font-bold text-[var(--c-teal-900)] mb-3">{t('requestStatusBreakdown')}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={requestStatusCounts} dataKey="value" nameKey="name" outerRadius={90} label>
                {requestStatusCounts.map((_, i) => <Cell key={i} fill={REQUEST_STATUS_COLORS[i % REQUEST_STATUS_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {!isPersonalView && (
        <Card>
          <h3 className="font-bold text-[var(--c-teal-900)] mb-1">{t('requestsByAssigneeTitle')}</h3>
          <p className="text-xs text-[var(--c-text-muted)] mb-3">{t('requestsByAssigneeSubtitle')}</p>
          {requestsByAssignee.length ? (
            <ResponsiveContainer width="100%" height={Math.max(220, requestsByAssignee.length * 46)}>
              <BarChart data={requestsByAssignee} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} fontSize={12} />
                <YAxis type="category" dataKey="name" width={130} fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="pending" name={t('assigneeStatusPending')} stackId="a" fill={REQUEST_STATUS_COLORS[0]} />
                <Bar dataKey="in_progress" name={t('assigneeStatusInProgress')} stackId="a" fill={REQUEST_STATUS_COLORS[1]} />
                <Bar dataKey="completed" name={t('assigneeStatusCompleted')} stackId="a" fill={REQUEST_STATUS_COLORS[2]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-[var(--c-text-muted)]">{t('noAssigneeData')}</p>
          )}
        </Card>
      )}
    </div>
  );
}
