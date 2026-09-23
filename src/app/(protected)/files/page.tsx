'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Card from '@/components/ui/Card';
import DataTable from '@/components/ui/DataTable';
import type { SharedFile } from '@/types/database';

export default function FilesPage() {
  const supabase = createClient();
  const { t } = useLanguage();

  const [files, setFiles] = useState<SharedFile[]>([]);
  const [canUpload, setCanUpload] = useState(false);
  const [userId, setUserId] = useState('');
  const [uploading, setUploading] = useState(false);

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
      setCanUpload(profile?.role === 'admin' || !!uploaderRow);
    }
  }

  useEffect(() => {
    loadFiles();
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('shared-files').upload(path, file);
    if (!error) {
      await supabase.from('shared_files').insert({
        file_name: file.name,
        file_path: path,
        uploaded_by: userId,
      });
      loadFiles();
    }
    setUploading(false);
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

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold text-teal-900">{t('filesTitle')}</h1>
        {canUpload && (
          <label className="bg-teal-700 text-white rounded-xl px-5 py-2.5 font-bold cursor-pointer">
            {uploading ? t('saving') : t('uploadNewFile')}
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        )}
      </div>

      <Card>
        <DataTable
          emptyMessage={t('noData')}
          rows={files}
          columns={[
            { header: t('fileName'), render: (f) => `📄 ${f.file_name}` },
            { header: t('uploadedBy'), render: (f) => f.profiles?.name || '-' },
            {
              header: t('actions'),
              render: (f) => (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDownload(f.file_path, f.file_name)}
                    className="text-teal-700 text-xs font-bold hover:underline"
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
    </main>
  );
}
