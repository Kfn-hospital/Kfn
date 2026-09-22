'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError('البريد أو كلمة المرور غير صحيحة');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-xl font-extrabold text-teal-900 mb-1 text-center">
          🔒 تسجيل الدخول
        </h1>
        <p className="text-sm text-slate-500 mb-6 text-center">
          بوابة خورفكان الإدارية
        </p>

        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="email"
            required
            placeholder="البريد الإلكتروني"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-xl px-3 py-2.5"
            dir="ltr"
          />
          <input
            type="password"
            required
            placeholder="كلمة المرور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-xl px-3 py-2.5"
          />

          {error && (
            <p className="text-sm font-bold text-red-600 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-700 text-white rounded-xl py-3 font-bold disabled:opacity-50"
          >
            {loading ? 'جارِ الدخول...' : 'دخول'}
          </button>
        </form>
      </div>
    </main>
  );
}
