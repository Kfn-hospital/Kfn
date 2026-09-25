'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';
import type {
  Checklist,
  ChecklistItem,
  ChecklistAssignment,
  ChecklistAccess,
  ChecklistAttachment,
  Profile,
} from '@/types/database';

type ChecklistWithProgress = Checklist & {
  itemsCount: number;
  doneCount: number;
  totalCount: number;
};

export default function ChecklistsPage() {
  const supabase = createClient();
  const { t } = useLanguage();

  const [checklists, setChecklists] = useState<ChecklistWithProgress[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [userId, setUserId] = useState('');

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newItems, setNewItems] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadList() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) setUserId(user.id);

    const { data } = await supabase
      .from('checklists')
      .select('*, checklist_items(id), checklist_assignments(is_done)')
      .order('created_at', { ascending: false });

    const withProgress = ((data as any[]) || []).map((c) => ({
      ...c,
      itemsCount: c.checklist_items?.length || 0,
      totalCount: c.checklist_assignments?.length || 0,
      doneCount: c.checklist_assignments?.filter((a: any) => a.is_done).length || 0,
    }));
    setChecklists(withProgress);

    const { data: profs } = await supabase.from('profiles').select('*').eq('status', 'active');
    setUsers((profs as Profile[]) || []);
  }

  useEffect(() => {
    loadList();
  }, []);

  function addItemField() {
    setNewItems([...newItems, '']);
  }
  function updateItemField(i: number, value: string) {
    const copy = [...newItems];
    copy[i] = value;
    setNewItems(copy);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data: checklist, error: err } = await supabase
      .from('checklists')
      .insert({ title: newTitle, description: newDesc || null, created_by: userId })
      .select()
      .single();

    if (err || !checklist) {
      setLoading(false);
      setError(err?.message || t('errorOccurred'));
      return;
    }

    const validItems = newItems.filter((i) => i.trim());
    if (validItems.length) {
      await supabase
        .from('checklist_items')
        .insert(validItems.map((text) => ({ checklist_id: checklist.id, item_text: text })));
    }

    setLoading(false);
    setCreateModalOpen(false);
    setNewTitle('');
    setNewDesc('');
    setNewItems(['']);
    loadList();
  }

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold text-[var(--c-teal-900)]">{t('checklistsTitle')}</h1>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="bg-[var(--c-teal-700)] text-white rounded-xl px-5 py-2.5 font-bold"
        >
          {t('newChecklist')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {checklists.map((c) => {
          const pct = c.totalCount ? Math.round((c.doneCount / c.totalCount) * 100) : 0;
          return (
            <Card key={c.id} className="cursor-pointer hover:shadow-lg" >
              <div onClick={() => setDetailId(c.id)}>
                <h3 className="font-extrabold text-[var(--c-teal-900)]">{c.title}</h3>
                <p className="text-[var(--c-text-muted)] text-xs mb-3">{c.description}</p>
                <div className="w-full bg-[var(--c-surface-muted)] rounded-full h-2 mb-1.5">
                  <div className="bg-[var(--c-teal-600)] h-2 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs text-[var(--c-text-muted)]">
                  {c.doneCount} / {c.totalCount} · {c.itemsCount} {t('checklistItems')}
                </div>
              </div>
            </Card>
          );
        })}
        {!checklists.length && (
          <p className="text-[var(--c-text-muted)] col-span-full text-center py-10">{t('noData')}</p>
        )}
      </div>

      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title={t('newChecklist')}>
        <form onSubmit={handleCreate} className="space-y-3">
          <FormField label={t('checklistTitle')} value={newTitle} onChange={setNewTitle} required />
          <FormField
            label={t('checklistDescription')}
            type="textarea"
            value={newDesc}
            onChange={setNewDesc}
          />
          <div className="text-sm font-bold text-[var(--c-teal-800)]">{t('checklistItems')}</div>
          {newItems.map((item, i) => (
            <input
              key={i}
              value={item}
              onChange={(e) => updateItemField(i, e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm"
              placeholder={`${t('checklistItems')} ${i + 1}`}
            />
          ))}
          <button
            type="button"
            onClick={addItemField}
            className="text-[var(--c-teal-700)] text-sm font-bold hover:underline"
          >
            {t('addItem')}
          </button>
          <Alert type="error" message={error} />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--c-teal-700)] text-white rounded-xl py-3 font-bold disabled:opacity-50"
          >
            {loading ? t('saving') : t('save')}
          </button>
        </form>
      </Modal>

      {detailId && (
        <ChecklistDetailModal
          checklistId={detailId}
          userId={userId}
          users={users}
          onClose={() => {
            setDetailId(null);
            loadList();
          }}
        />
      )}
    </main>
  );
}

// ============ نافذة تفاصيل قائمة واحدة (بنود، تعيينات، صلاحيات، مرفقات) ============
function ChecklistDetailModal({
  checklistId,
  userId,
  users,
  onClose,
}: {
  checklistId: string;
  userId: string;
  users: Profile[];
  onClose: () => void;
}) {
  const supabase = createClient();
  const { t } = useLanguage();

  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [assignments, setAssignments] = useState<ChecklistAssignment[]>([]);
  const [access, setAccess] = useState<ChecklistAccess[]>([]);
  const [attachments, setAttachments] = useState<ChecklistAttachment[]>([]);
  const [canEdit, setCanEdit] = useState(false);

  const [newItemText, setNewItemText] = useState('');
  const [newAccessUser, setNewAccessUser] = useState('');

  async function load() {
    const { data: cl } = await supabase.from('checklists').select('*').eq('id', checklistId).single();
    setChecklist(cl);

    const { data: its } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('checklist_id', checklistId)
      .order('created_at');
    setItems((its as ChecklistItem[]) || []);

    const { data: asg } = await supabase
      .from('checklist_assignments')
      .select('*, profiles(*)')
      .eq('checklist_id', checklistId);
    setAssignments((asg as ChecklistAssignment[]) || []);

    const { data: acc } = await supabase
      .from('checklist_access')
      .select('*, profiles(*)')
      .eq('checklist_id', checklistId);
    setAccess((acc as ChecklistAccess[]) || []);

    const { data: files } = await supabase
      .from('checklist_attachments')
      .select('*')
      .eq('checklist_id', checklistId);
    setAttachments((files as ChecklistAttachment[]) || []);

    setCanEdit(cl?.created_by === userId || (acc || []).some((a: any) => a.user_id === userId && a.can_edit));
  }

  useEffect(() => {
    load();
  }, [checklistId]);

  async function toggleAssignment(assignmentId: string, current: boolean) {
    await supabase
      .from('checklist_assignments')
      .update({ is_done: !current, done_at: !current ? new Date().toISOString() : null })
      .eq('id', assignmentId);
    load();
  }

  async function addItem() {
    if (!newItemText.trim()) return;
    await supabase
      .from('checklist_items')
      .insert({ checklist_id: checklistId, item_text: newItemText.trim() });
    setNewItemText('');
    load();
  }

  async function deleteItem(id: string) {
    await supabase.from('checklist_items').delete().eq('id', id);
    load();
  }

  async function assignUserToItem(itemId: string, userIdToAssign: string) {
    if (!userIdToAssign) return;
    await supabase.from('checklist_assignments').insert({
      item_id: itemId,
      checklist_id: checklistId,
      assigned_to: userIdToAssign,
    });
    load();
  }

  async function addAccess() {
    if (!newAccessUser) return;
    await supabase
      .from('checklist_access')
      .insert({ checklist_id: checklistId, user_id: newAccessUser, can_edit: false });
    setNewAccessUser('');
    load();
  }

  async function toggleAccessEdit(uid: string, current: boolean) {
    await supabase
      .from('checklist_access')
      .update({ can_edit: !current })
      .eq('checklist_id', checklistId)
      .eq('user_id', uid);
    load();
  }

  async function removeAccess(uid: string) {
    await supabase.from('checklist_access').delete().eq('checklist_id', checklistId).eq('user_id', uid);
    load();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `${checklistId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('checklist-attachments').upload(path, file);
    if (!error) {
      await supabase.from('checklist_attachments').insert({
        checklist_id: checklistId,
        file_name: file.name,
        file_path: path,
        uploaded_by: userId,
      });
      load();
    }
  }

  async function deleteAttachment(id: string, path: string) {
    await supabase.storage.from('checklist-attachments').remove([path]);
    await supabase.from('checklist_attachments').delete().eq('id', id);
    load();
  }

  async function deleteChecklist() {
    if (!confirm(t('deleteConfirm'))) return;
    await supabase.from('checklists').delete().eq('id', checklistId);
    onClose();
  }

  if (!checklist) return null;

  return (
    <Modal open={true} onClose={onClose} title={checklist.title}>
      <p className="text-[var(--c-text-muted)] text-sm mb-4">{checklist.description}</p>

      <div className="space-y-3 mb-5">
        {items.map((item) => {
          const itemAssignments = assignments.filter((a) => a.item_id === item.id);
          return (
            <div key={item.id} className="border rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm">{item.item_text}</span>
                {canEdit && (
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    🗑️
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {itemAssignments.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={a.is_done}
                      disabled={a.assigned_to !== userId}
                      onChange={() => toggleAssignment(a.id, a.is_done)}
                      className="w-4 h-4 accent-[var(--c-teal-600)]"
                    />
                    <span className={a.is_done ? 'line-through text-[var(--c-text-muted)]' : ''}>
                      {a.profiles?.name}
                    </span>
                  </label>
                ))}
              </div>
              {canEdit && (
                <select
                  onChange={(e) => {
                    assignUserToItem(item.id, e.target.value);
                    e.target.value = '';
                  }}
                  className="mt-2 w-full border rounded-lg px-2 py-1 text-xs"
                >
                  <option value="">+ {t('add')}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>

      <div className="mb-5 pt-4 border-t">
        <div className="text-sm font-bold text-[var(--c-teal-800)] mb-2">{t('attachments')}</div>
        {attachments.map((f) => (
          <div key={f.id} className="flex items-center justify-between bg-[var(--c-bg)] rounded-lg px-3 py-2 text-sm mb-1.5">
            <span>📄 {f.file_name}</span>
            {(f.uploaded_by === userId || canEdit) && (
              <span
                onClick={() => deleteAttachment(f.id, f.file_path)}
                className="cursor-pointer text-red-400 hover:text-red-600"
              >
                🗑️
              </span>
            )}
          </div>
        ))}
        <label className="text-[var(--c-teal-700)] text-sm font-bold hover:underline cursor-pointer">
          {t('uploadFile')}
          <input type="file" className="hidden" onChange={handleUpload} />
        </label>
      </div>

      {canEdit && (
        <>
          <div className="mb-5 pt-4 border-t">
            <div className="text-sm font-bold text-[var(--c-teal-800)] mb-2">{t('addItem')}</div>
            <div className="flex gap-2">
              <input
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                className="flex-1 border rounded-xl px-3 py-2 text-sm"
              />
              <button onClick={addItem} className="bg-[var(--c-teal-700)] text-white rounded-xl px-4 text-sm font-bold">
                {t('add')}
              </button>
            </div>
          </div>

          <div className="mb-5 pt-4 border-t">
            <div className="text-sm font-bold text-[var(--c-teal-800)] mb-2">{t('checklistAccess')}</div>
            {access.map((a) => (
              <div key={a.user_id} className="flex items-center justify-between bg-[var(--c-bg)] rounded-lg px-3 py-2 text-sm mb-1.5">
                <span className="font-bold">{a.profiles?.name}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAccessEdit(a.user_id, a.can_edit)}
                    className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                      a.can_edit ? 'bg-[var(--c-teal-600)] text-white' : 'bg-slate-200 text-[var(--c-text)]'
                    }`}
                  >
                    {a.can_edit ? t('canEdit') : t('viewOnly')}
                  </button>
                  <span onClick={() => removeAccess(a.user_id)} className="cursor-pointer text-red-400">
                    🗑️
                  </span>
                </div>
              </div>
            ))}
            <select
              value={newAccessUser}
              onChange={(e) => setNewAccessUser(e.target.value)}
              className="w-full border rounded-lg px-2 py-1.5 text-sm mb-2"
            >
              <option value="">—</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <button onClick={addAccess} className="text-[var(--c-teal-700)] text-sm font-bold hover:underline">
              {t('add')}
            </button>
          </div>

          <div className="pt-4 border-t text-left">
            <button onClick={deleteChecklist} className="text-red-600 text-xs font-bold hover:underline">
              🗑️ {t('delete')}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
