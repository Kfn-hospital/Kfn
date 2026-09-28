-- ============================================================
-- 1) تضييق رؤية طلبات التنسيق والمتابعة: كل موظف يشوف طلباته هو بس
--    (اللي قدمها بنفسه أو معيّن عليها)، وفريق التنسيق والمتابعة أو الأدمن
--    يشوفوا كل الطلبات.
-- ============================================================

drop policy if exists "أي مستخدم مسجل يشوف كل الطلبات" on requests;

create policy "الموظف يشوف طلباته وفريق التنسيق يشوف الكل" on requests
  for select using (
    is_coordination_manager()
    or auth.uid() = created_by
    or exists (
      select 1 from request_assignees ra
      where ra.request_id = requests.id
      and ra.user_id = auth.uid()
    )
  );

-- نفس المنطق على جدول المُعيَّنين، دفاعًا في العمق (defense in depth)
drop policy if exists "أي مستخدم مسجل يشوف المُعيَّنين" on request_assignees;

create policy "الموظف يشوف تعييناته وفريق التنسيق يشوف الكل" on request_assignees
  for select using (
    is_coordination_manager()
    or user_id = auth.uid()
    or exists (
      select 1 from requests r
      where r.id = request_assignees.request_id
      and r.created_by = auth.uid()
    )
  );

-- ============================================================
-- 2) عمود سبب الرفض/الإلغاء في الحجوزات، يتبعت مع إشعار القرار
-- ============================================================

alter table bookings add column if not exists decision_reason text;
