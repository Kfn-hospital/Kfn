import type { Metadata } from 'next';
import './globals.css';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import ThemeProvider from '@/lib/theme/ThemeProvider';

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
      <body className="bg-[var(--c-bg)] min-h-screen">
        <LanguageProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
