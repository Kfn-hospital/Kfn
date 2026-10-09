-- 1) المسؤول عن القاعة (قسم أو شخص) يظهر لكل الموظفين، والأدمن بس يعدّله
alter table rooms add column if not exists responsible text;
alter table rooms add column if not exists responsible_en text;

create or replace function guard_room_responsible()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not is_admin()
     and (new.responsible is distinct from old.responsible
          or new.responsible_en is distinct from old.responsible_en) then
    raise exception 'تعديل المسؤول عن القاعة للأدمن فقط';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_room_responsible on rooms;
create trigger trg_guard_room_responsible
  before update on rooms
  for each row execute function guard_room_responsible();

-- 2) صاحب الحجز ما يعدّلش حجزه إلا لو مسؤول القاعة رجّعه للتعديل
create or replace function enforce_booking_edit_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_manager boolean;
begin
  -- الخدمات الداخلية (service role) ما عندهاش مستخدم
  if auth.uid() is null then
    return new;
  end if;

  is_manager := is_admin() or exists (
    select 1 from room_managers
    where room_id = old.room_id and user_id = auth.uid()
  );
  if is_manager then
    return new;
  end if;

  if old.booked_by = auth.uid() then
    -- مُعاد للتعديل: يعدّل ويعيد الإرسال (pending) أو يلغي
    if old.status::text = 'needs_edit' then
      if new.status::text in ('needs_edit', 'pending', 'cancelled') then
        return new;
      end if;
      raise exception 'غير مسموح بتغيير حالة الحجز';
    end if;

    -- باقي الحالات: الإلغاء فقط بدون أي تعديل في التفاصيل
    if new.status::text = 'cancelled'
       and new.room_id = old.room_id
       and new.booking_date = old.booking_date
       and new.start_time = old.start_time
       and new.end_time = old.end_time
       and new.title = old.title then
      return new;
    end if;
    raise exception 'لا يمكن تعديل الحجز إلا بعد إرجاعه للتعديل من مسؤول القاعة';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_booking_edit_rules on bookings;
create trigger trg_enforce_booking_edit_rules
  before update on bookings
  for each row execute function enforce_booking_edit_rules();
