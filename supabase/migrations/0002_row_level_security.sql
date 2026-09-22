-- ============================================================
-- سياسات الأمان (Row Level Security)
-- ============================================================

create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- ---------- profiles ----------
alter table profiles enable row level security;

create policy "الكل يقدر يشوف بيانات أي مستخدم فعّال" on profiles
  for select using (status = 'active' or is_admin());

create policy "الأدمن بس يعدّل/يضيف/يحذف مستخدمين" on profiles
  for all using (is_admin());

create policy "المستخدم يقدر يعدّل بياناته هو بس" on profiles
  for update using (auth.uid() = id);

-- ---------- rooms ----------
alter table rooms enable row level security;

create policy "الكل يشوف القاعات" on rooms for select using (true);
create policy "الأدمن بس يضيف قاعات" on rooms
  for insert with check (is_admin());
create policy "الأدمن أو مسؤول القاعة يعدّلها" on rooms
  for update using (
    is_admin() or exists (
      select 1 from room_managers where room_id = rooms.id and user_id = auth.uid()
    )
  );
create policy "الأدمن بس يحذف قاعة" on rooms for delete using (is_admin());

-- ---------- bookings ----------
alter table bookings enable row level security;

create policy "الكل يشوف الحجوزات" on bookings for select using (true);
create policy "أي مستخدم يقدر يحجز" on bookings
  for insert with check (auth.uid() = booked_by);
create policy "صاحب الحجز أو الأدمن أو مسؤول القاعة يعدّل" on bookings
  for update using (
    auth.uid() = booked_by or is_admin() or exists (
      select 1 from room_managers where room_id = bookings.room_id and user_id = auth.uid()
    )
  );

-- ---------- checklists ----------
alter table checklists enable row level security;
alter table checklist_items enable row level security;
alter table checklist_assignments enable row level security;
alter table checklist_access enable row level security;
alter table checklist_attachments enable row level security;

create or replace function can_edit_checklist(cl_id uuid)
returns boolean as $$
  select is_admin() or exists (
    select 1 from checklists where id = cl_id and created_by = auth.uid()
  ) or exists (
    select 1 from checklist_access where checklist_id = cl_id and user_id = auth.uid() and can_edit = true
  );
$$ language sql security definer stable;

create or replace function can_view_checklist(cl_id uuid)
returns boolean as $$
  select is_admin() or exists (
    select 1 from checklists where id = cl_id and created_by = auth.uid()
  ) or exists (
    select 1 from checklist_access where checklist_id = cl_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

create policy "يشوف القائمة: منشئها أو صاحب صلاحية أو معيّن على بند فيها" on checklists
  for select using (
    can_view_checklist(id) or exists (
      select 1 from checklist_assignments where checklist_id = checklists.id and assigned_to = auth.uid()
    )
  );

create policy "من له صلاحية إنشاء قوائم بس ينشئ" on checklists
  for insert with check (
    is_admin() or exists (select 1 from checklist_creators where user_id = auth.uid())
  );

create policy "من يقدر يعدّل القائمة" on checklists
  for update using (can_edit_checklist(id));

create policy "من يقدر يحذف القائمة" on checklists
  for delete using (can_edit_checklist(id));

create policy "بنود القائمة تُشاهد زي القائمة نفسها" on checklist_items
  for select using (can_view_checklist(checklist_id) or exists (
    select 1 from checklist_assignments where item_id = checklist_items.id and assigned_to = auth.uid()
  ));
create policy "إضافة/حذف بند لمن يقدر يعدّل القائمة" on checklist_items
  for all using (can_edit_checklist(checklist_id));

create policy "المعيّن عليه بس يقدر يحدّث حالة تعيينه" on checklist_assignments
  for update using (assigned_to = auth.uid() or can_edit_checklist(checklist_id));
create policy "مشاهدة التعيينات لمن يشوف القائمة" on checklist_assignments
  for select using (assigned_to = auth.uid() or can_view_checklist(checklist_id));
create policy "إضافة تعيينات لمن يعدّل القائمة" on checklist_assignments
  for insert with check (can_edit_checklist(checklist_id));

create policy "إدارة صلاحيات القائمة لمن يعدّلها" on checklist_access
  for all using (can_edit_checklist(checklist_id));

create policy "مشاهدة المرفقات لمن يشوف القائمة" on checklist_attachments
  for select using (can_view_checklist(checklist_id) or exists (
    select 1 from checklist_assignments where checklist_id = checklist_attachments.checklist_id and assigned_to = auth.uid()
  ));
create policy "رفع مرفق لأي معنيّ بالقائمة" on checklist_attachments
  for insert with check (can_view_checklist(checklist_id) or exists (
    select 1 from checklist_assignments where checklist_id = checklist_attachments.checklist_id and assigned_to = auth.uid()
  ));
create policy "حذف مرفق للرافع نفسه أو من يعدّل القائمة" on checklist_attachments
  for delete using (uploaded_by = auth.uid() or can_edit_checklist(checklist_id));

-- ---------- shared_files ----------
alter table shared_files enable row level security;

create policy "الكل يشوف الملفات المشتركة" on shared_files for select using (true);
create policy "من له صلاحية رفع ملفات بس يرفع" on shared_files
  for insert with check (
    is_admin() or exists (select 1 from file_uploaders where user_id = auth.uid())
  );
create policy "من له صلاحية رفع ملفات بس يحذف/يعدّل" on shared_files
  for all using (
    is_admin() or exists (select 1 from file_uploaders where user_id = auth.uid())
  );

-- ---------- app_settings, checklist_creators, file_uploaders ----------
alter table app_settings enable row level security;
alter table checklist_creators enable row level security;
alter table file_uploaders enable row level security;

create policy "الكل يقرأ الإعدادات" on app_settings for select using (true);
create policy "الأدمن بس يعدّل الإعدادات" on app_settings for all using (is_admin());
create policy "الأدمن بس يدير مين ينشئ قوائم" on checklist_creators for all using (is_admin());
create policy "الأدمن بس يدير مين يرفع ملفات" on file_uploaders for all using (is_admin());

-- ---------- audit_log ----------
alter table audit_log enable row level security;
create policy "الأدمن بس يشوف السجل" on audit_log for select using (is_admin());
create policy "أي مستخدم مسجّل يقدر يسجّل حدث" on audit_log for insert with check (auth.uid() is not null);
