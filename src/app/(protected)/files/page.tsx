'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';
import DataTable from '@/components/ui/DataTable';
import type { SharedFile } from '@/types/database';

export default function FilesPage() {
  const supabase = createClient();
  const { t, lang } = useLanguage();

  const [files, setFiles] = useState<SharedFile[]>([]);
  const [canUpload, setCanUpload] = useState(false);
  const [userId, setUserId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [error, setError] = useState('');

  async function loadFiles() {
    const { data } = await supabase
      .from('shared_files')
      .select('*, profiles(*)')
      .order('uploaded_at', { ascending: false });
    setFiles((data as SharedFile[]) || []);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      const { data: uploaderRow } = await supabase
        .from('file_uploaders')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      setCanUpload(profile?.role === 'admin' || profile?.role === 'coordination_admin' || !!uploaderRow);
    }
  }

  useEffect(() => {
    loadFiles();
  }, []);

  function openPicker(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setNameAr(file.name.replace(/\.[^/.]+$/, ''));
    setNameEn('');
    setError('');
    setModalOpen(true);
    e.target.value = '';
  }

  async function confirmUpload() {
    if (!pendingFile) return;
    if (!nameAr.trim()) {
      setError(t('errorOccurred'));
      return;
    }
    setUploading(true);
    setError('');

    const path = `${Date.now()}_${pendingFile.name}`;
    const { error: uploadError } = await supabase.storage.from('shared-files').upload(path, pendingFile);

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from('shared_files').insert({
      file_name: nameAr.trim(),
      file_name_en: nameEn.trim() || null,
      file_path: path,
      uploaded_by: userId,
    });

    setUploading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setModalOpen(false);
    setPendingFile(null);
    loadFiles();
  }

  async function handleDownload(path: string, name: string) {
    const { data } = await supabase.storage.from('shared-files').download(path);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  async function handleDelete(id: string, path: string) {
    if (!confirm(t('deleteConfirm'))) return;
    await supabase.storage.from('shared-files').remove([path]);
    await supabase.from('shared_files').delete().eq('id', id);
    loadFiles();
  }

  const displayName = (f: SharedFile) => (lang === 'en' && f.file_name_en ? f.file_name_en : f.file_name);

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold text-[var(--c-teal-900)]">{t('filesTitle')}</h1>
        {canUpload && (
          <label className="bg-[var(--c-teal-700)] text-white rounded-xl px-5 py-2.5 font-bold cursor-pointer">
            {t('uploadNewFile')}
            <input type="file" className="hidden" onChange={openPicker} disabled={uploading} />
          </label>
        )}
      </div>

      <Card>
        <DataTable
          emptyMessage={t('noData')}
          rows={files}
          columns={[
            { header: t('fileName'), render: (f) => `📄 ${displayName(f)}` },
            { header: t('uploadedBy'), render: (f) => f.profiles?.name || '-' },
            {
              header: t('actions'),
              render: (f) => (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDownload(f.file_path, displayName(f))}
                    className="text-[var(--c-teal-700)] text-xs font-bold hover:underline"
                  >
                    {t('download')}
                  </button>
                  {canUpload && (
                    <button
                      onClick={() => handleDelete(f.id, f.file_path)}
                      className="text-red-500 text-xs font-bold hover:underline"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('uploadNewFile')}>
        <div className="space-y-3">
          <p className="text-sm text-[var(--c-text-muted)]">📄 {pendingFile?.name}</p>
          <FormField label={t('fileNameAr')} value={nameAr} onChange={setNameAr} required />
          <FormField label={t('fileNameEn')} value={nameEn} onChange={setNameEn} />
          <Alert type="error" message={error} />
          <button
            onClick={confirmUpload}
            disabled={uploading}
            className="w-full bg-[var(--c-teal-700)] text-white rounded-xl py-3 font-bold disabled:opacity-50"
          >
            {uploading ? t('saving') : t('save')}
          </button>
        </div>
      </Modal>
    </main>
  );
}
