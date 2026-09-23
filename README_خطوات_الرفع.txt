خطوات النزول والرفع (Terminal)
================================

1. فك الضغط عن الملفات وانسخها داخل مجلد المشروع (Kfn) بنفس المسارات بالظبط:
   - src/app/(protected)/reports/page.tsx
   - src/app/(protected)/admin/settings/page.tsx
   - src/app/api/settings/test-gemini/route.ts
   - supabase/migrations/0003_branding_storage_bucket.sql

2. ثبّت مكتبة الرسوم البيانية:
   npm install recharts

3. افتح TRANSLATIONS_TO_ADD.txt وانسخ المفاتيح داخل:
   src/lib/i18n/translations.ts  (جوه كائن ar وجوه كائن en)

4. افتح SIDEBAR_SNIPPET_TO_ADD.txt وضيف الروابط في ملف الشريط الجانبي.

5. شغّل ملف SQL ده مرة واحدة في Supabase SQL Editor:
   supabase/migrations/0003_branding_storage_bucket.sql

6. تأكد إن كل حاجة شغالة محليًا:
   npm run build

7. ارفع على GitHub:
   git add .
   git commit -m "إضافة صفحة الإحصائيات والتقارير وإعدادات البرنامج"
   git pull origin main
   git push

8. تأكد إن Vercel عمل Deploy ناجح، وبعدين افتح /reports و /admin/settings
   على الموقع للتجربة.

ملاحظات:
- صفحة الإعدادات بتفترض إن جدول app_settings شكله (key, value, updated_at).
  لو الشكل مختلف عندك، ابعتلي نتيجة الفحص اللي طلبته قبل كده وهاعدل الصفحة.
- زرار "اختبار الاتصال" بيستخدم مفتاح Gemini اللي هتكتبه في الصفحة، وبيتفحص
  عن طريق src/app/api/settings/test-gemini/route.ts (سيرفر-سايد، آمن).
