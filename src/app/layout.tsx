import type { Metadata } from 'next';
import './globals.css';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';

export const metadata: Metadata = {
  title: 'بوابة خورفكان الإدارية',
  description: 'نظام إدارة القاعات والحجوزات والطلبات — مستشفى خورفكان',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // القيمة الافتراضية عربي/RTL وقت أول تحميل من السيرفر — بعدها LanguageProvider
  // بيحدّثها فورًا لو المستخدم كان مختار إنجليزي قبل كده (محفوظة في المتصفح)
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-slate-50 min-h-screen">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
