-- شغّل الاستعلام ده في Supabase SQL Editor وابعتلي النتيجة
-- عشان أراجع صلاحيات قاعدة البيانات (RLS) على جداول طلبات التنسيق والمتابعة

-- 1) هل RLS مفعّل أصلاً على الجداول دي؟
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relname in ('requests', 'request_categories', 'request_assignees')
order by relname;

-- 2) كل الصلاحيات (policies) الموجودة على الجداول دي بالتفصيل
select
  tablename,
  policyname,
  cmd as operation,
  qual as using_condition,
  with_check
from pg_policies
where tablename in ('requests', 'request_categories', 'request_assignees')
order by tablename, cmd;
