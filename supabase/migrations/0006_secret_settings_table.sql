-- جدول منفصل للمفاتيح السرية (Gemini, Brevo) بدل ما تكون في app_settings
-- العام اللي أي مستخدم مسجّل دخول يقدر يقرأه (سياسة "الكل يقرأ الإعدادات").
-- الجدول ده مقفول تمامًا على الأدمن بس، قراءة وكتابة.

create table if not exists app_secrets (
  key text primary key,
  value text
);

alter table app_secrets enable row level security;

drop policy if exists "الأدمن بس يدير المفاتيح السرية" on app_secrets;
create policy "الأدمن بس يدير المفاتيح السرية" on app_secrets
  for all using (is_admin());

-- ننقل أي مفاتيح موجودة حاليًا من app_settings العام لجدول app_secrets الخاص
insert into app_secrets (key, value)
select key, value from app_settings where key in ('gemini_api_key', 'brevo_api_key')
on conflict (key) do update set value = excluded.value;

delete from app_settings where key in ('gemini_api_key', 'brevo_api_key');
