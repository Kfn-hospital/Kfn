import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import './globals.css';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import ThemeProvider from '@/lib/theme/ThemeProvider';
import { ConfirmProvider } from '@/lib/confirm/ConfirmContext';

export async function generateMetadata(): Promise<Metadata> {
  let title = 'بوابة خورفكان الإدارية';
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'site_name_ar')
      .maybeSingle();
    if (data?.value) title = data.value as string;
  } catch {
    // لو حصل أي خطأ (مثلاً السيرفر لسه بيقوم) نستخدم الاسم الافتراضي
  }
  return {
    title,
    description: 'نظام إدارة القاعات والحجوزات والطلبات — مستشفى خورفكان',
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // القيمة الافتراضية عربي/RTL وقت أول تحميل من السيرفر — بعدها LanguageProvider
  // بيحدّثها فورًا لو المستخدم كان مختار إنجليزي قبل كده (محفوظة في المتصفح)
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-[var(--c-bg)] min-h-screen">
        {/* بيطبّق آخر ألوان محفوظة محليًا فورًا قبل أي حاجة تانية تترسم، عشان
            يمنع وميض اللون الافتراضي (زي الأخضر) قبل ظهور اللون اللي
            المستخدم اختاره (زي الأزرق) لحد ما يوصل رد قاعدة البيانات */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var r=JSON.parse(localStorage.getItem('kfn-theme-cache-v1'));if(!r)return;var s=document.documentElement.style;for(var k in r){s.setProperty(k,r[k]);}}catch(e){}})();`,
          }}
        />
        <LanguageProvider>
          <ThemeProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
