-- الأدمن أو مسؤول القاعة يقدر يحذف الحجوزات الملغية فقط (نهائيًا)
drop policy if exists "الأدمن أو مسؤول القاعة يحذف الحجز الملغي" on bookings;

create policy "الأدمن أو مسؤول القاعة يحذف الحجز الملغي" on bookings
  for delete using (
    status = 'cancelled'
    and (
      is_admin()
      or exists (
        select 1 from room_managers
        where room_id = bookings.room_id and user_id = auth.uid()
      )
    )
  );
