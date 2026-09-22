# بوابة خورفكان الإدارية — النسخة الجديدة (Next.js + Supabase + Vercel)

## الحالة الحالية
- ✅ قاعدة البيانات كاملة (`supabase/migrations/`)
- ✅ سياسات الأمان (RLS) جاهزة
- ✅ هيكل المشروع الأساسي وصفحة مثال شغّالة (القاعات)
- ⏳ باقي الصفحات (تسجيل الدخول، الحجوزات الكاملة، الطلبات، قوائم التحقق، لوحة الأدمن) — هنكمّلها مع بعض تباعًا

## خطوات الرفع على GitHub

```bash
cd khorfakkan-web
git init
git add .
git commit -m "الإصدار الأول — هيكل المشروع وقاعدة البيانات"
git branch -M main
git remote add origin https://github.com/USERNAME/khorfakkan-portal.git
git push -u origin main
```

استبدلي `USERNAME` باسم حسابك، و`khorfakkan-portal` باسم الريبو اللي أنشأتيه.

## ربط Vercel

1. روحي [vercel.com](https://vercel.com) → New Project → اختاري الريبو ده.
2. في خطوة "Environment Variables"، أضيفي:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (القيم موجودة في Supabase → Settings → API)
3. دوسي Deploy.

## التشغيل محليًا (اختياري، لو حابة تجربي على جهازك قبل الرفع)

```bash
npm install
cp .env.example .env.local   # واملئي القيم الفعلية
npm run dev
```

## الخطوة الجاية
بعد ما ترفعي المشروع ده على GitHub وتربطيه بـ Vercel، ارجعي لينا نكمل بناء باقي الصفحات مع بعض واحدة واحدة.
