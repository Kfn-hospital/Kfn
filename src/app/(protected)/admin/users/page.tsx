'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import DataTable from '@/components/ui/DataTable';
import type { Profile, UserRole } from '@/types/database';

type Tab = 'regular' | 'admins';

const ADMIN_ROLES: UserRole[] = ['admin', 'room_manager', 'coordinator', 'coordination_admin'];

export default function UsersPage() {
  const supabase = createClient();
  const { t } = useLanguage();
  const [users, setUsers] = useState<Profile[]>([]);
  const [tab, setTab] = useState<Tab>('regular');

  async function loadUsers() {
    const { data } = await supabase.from('profiles').select('*').order('name');
    setUsers((data as Profile[]) || []);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function updateRole(id: string, role: UserRole) {
    await supabase.from('profiles').update({ role }).eq('id', id);
    loadUsers();
  }

  async function activateUser(id: string) {
    await supabase.from('profiles').update({ status: 'active' }).eq('id', id);
    loadUsers();
  }

  async function toggleStatus(id: string, current: string) {
    await supabase
      .from('profiles')
      .update({ status: current === 'active' ? 'suspended' : 'active' })
      .eq('id', id);
    loadUsers();
  }

  const roleLabel: Record<string, string> = {
    admin: t('roleAdmin'),
    room_manager: t('roleRoomManager'),
    coordinator: t('roleCoordinator'),
    coordination_admin: t('roleCoordinationAdmin'),
    employee: t('roleEmployee'),
  };

  const regularUsers = useMemo(() => users.filter((u) => u.role === 'employee'), [users]);
  const adminUsers = useMemo(() => users.filter((u) => ADMIN_ROLES.includes(u.role as UserRole)), [users]);
  const pendingCount = useMemo(() => users.filter((u) => u.status === 'pending').length, [users]);

  const renderStatus = (u: Profile) => {
    if (u.status === 'pending') {
      return (
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
            {t('pendingApproval')}
          </span>
          <button
            onClick={() => activateUser(u.id)}
            className="px-2 py-1 rounded-full text-xs font-bold bg-[var(--c-teal-700)] text-white"
          >
            {t('activate')}
          </button>
        </div>
      );
    }
    return (
      <button
        onClick={() => toggleStatus(u.id, u.status)}
        className={`px-2 py-1 rounded-full text-xs font-bold ${
          u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}
      >
        {u.status === 'active' ? t('active') : t('inactive')}
      </button>
    );
  };

  const columns = [
    { header: t('name'), render: (u: Profile) => u.name },
    { header: 'Email', render: (u: Profile) => u.email },
    { header: t('signupPhone'), render: (u: Profile) => u.phone || '-' },
    { header: t('userDepartment'), render: (u: Profile) => u.department || '-' },
    {
      header: t('userRole'),
      render: (u: Profile) => (
        <select
          value={u.role}
          onChange={(e) => updateRole(u.id, e.target.value as UserRole)}
          className="border rounded-lg px-2 py-1 text-sm"
        >
          {Object.entries(roleLabel).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
      ),
    },
    { header: t('status'), render: renderStatus },
  ];

  return (
    <main className="p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="text-2xl font-extrabold text-[var(--c-teal-900)]">{t('usersTitle')}</h1>
        <Link
          href="/admin/users/new"
          className="bg-[var(--c-teal-700)] text-white rounded-xl px-5 py-2.5 font-bold text-sm"
        >
          ➕ {t('addUser')}
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setTab('regular')}
          className={`px-4 py-2 rounded-xl text-sm font-bold ${
            tab === 'regular' ? 'bg-[var(--c-teal-700)] text-white' : 'bg-white text-slate-600'
          }`}
        >
          {t('usersTabRegular')} {pendingCount > 0 && `(${pendingCount} ${t('pendingApproval')})`}
        </button>
        <button
          onClick={() => setTab('admins')}
          className={`px-4 py-2 rounded-xl text-sm font-bold ${
            tab === 'admins' ? 'bg-[var(--c-teal-700)] text-white' : 'bg-white text-slate-600'
          }`}
        >
          {t('usersTabAdmins')}
        </button>
      </div>

      <Card>
        <DataTable
          emptyMessage={t('noData')}
          rows={tab === 'regular' ? regularUsers : adminUsers}
          columns={columns}
        />
      </Card>
    </main>
  );
}
