'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import DataTable from '@/components/ui/DataTable';
import type { Profile, UserRole } from '@/types/database';

export default function UsersPage() {
  const supabase = createClient();
  const { t } = useLanguage();
  const [users, setUsers] = useState<Profile[]>([]);

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
    employee: t('roleEmployee'),
  };

  return (
    <main className="p-6">
      <h1 className="text-2xl font-extrabold text-teal-900 mb-6">{t('usersTitle')}</h1>

      <Card>
        <DataTable
          emptyMessage={t('noData')}
          rows={users}
          columns={[
            { header: t('name'), render: (u) => u.name },
            { header: 'Email', render: (u) => u.email },
            { header: t('userDepartment'), render: (u) => u.department || '-' },
            {
              header: t('userRole'),
              render: (u) => (
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
            {
              header: t('status'),
              render: (u) => (
                <button
                  onClick={() => toggleStatus(u.id, u.status)}
                  className={`px-2 py-1 rounded-full text-xs font-bold ${
                    u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {u.status === 'active' ? t('active') : t('inactive')}
                </button>
              ),
            },
          ]}
        />
      </Card>
    </main>
  );
}
