-- الأدمن أو مسؤول القاعة المُسند لها يقدر يحذف أي حجز (أي حالة) نهائيًا
drop policy if exists "الأدمن أو مسؤول القاعة يحذف الحجز الملغي" on bookings;
drop policy if exists "الأدمن أو مسؤول القاعة يحذف الحجز" on bookings;

create policy "الأدمن أو مسؤول القاعة يحذف الحجز" on bookings
  for delete using (
    is_admin()
    or exists (
      select 1 from room_managers
      where room_id = bookings.room_id and user_id = auth.uid()
    )
  );
