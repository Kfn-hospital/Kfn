-- ============================================================
-- تشديد صلاحيات قاعدة البيانات (RLS) على جداول طلبات التنسيق والمتابعة
-- ============================================================
-- المشكلة: الجداول التلاتة دي كانت شغالة بصلاحية "authenticated_full_access"
-- (using: true, with_check: true) على كل العمليات — يعني أي مستخدم مسجّل دخول
-- (حتى موظف عادي أو حساب لسه pending) يقدر يعدّل/يحذف أي طلب أو تصنيف أو تعيين
-- مباشرة عن طريق استدعاء Supabase من المتصفح (console)، بغض النظر عن قيود
-- الواجهة (زي "الحذف للأدمن بس" أو "التعديل لفريق التنسيق بس").
--
-- الحل: نطابق صلاحيات القاعدة مع نفس القواعد المطبّقة فعليًا في الواجهة.

create or replace function is_coordination_manager()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'coordinator', 'coordination_admin')
  );
$$ language sql security definer stable;

-- ---------- requests ----------
drop policy if exists "authenticated_full_access" on requests;

create policy "أي مستخدم مسجل يشوف كل الطلبات" on requests
  for select using (auth.uid() is not null);

create policy "أي مستخدم مسجل ينشئ طلب باسمه هو بس" on requests
  for insert with check (auth.uid() = created_by);

create policy "فريق التنسيق والمتابعة بس يعدّل الطلبات" on requests
  for update using (is_coordination_manager());

create policy "الأدمن بس يحذف طلب" on requests
  for delete using (is_admin());

-- ---------- request_categories ----------
drop policy if exists "authenticated_full_access" on request_categories;

create policy "أي مستخدم مسجل يشوف التصنيفات" on request_categories
  for select using (auth.uid() is not null);

create policy "الأدمن بس يدير التصنيفات" on request_categories
  for all using (is_admin()) with check (is_admin());

-- ---------- request_assignees ----------
drop policy if exists "authenticated_full_access" on request_assignees;

create policy "أي مستخدم مسجل يشوف المُعيَّنين" on request_assignees
  for select using (auth.uid() is not null);

create policy "فريق التنسيق والمتابعة بس يدير المُعيَّنين" on request_assignees
  for all using (is_coordination_manager()) with check (is_coordination_manager());
