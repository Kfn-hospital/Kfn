-- رسالة الموافقة على سياسة حجز القاعة (تظهر كـ checkbox عند الحجز من لوحة التحكم،
-- وكسؤال تأكيد في المساعد الذكي قبل إتمام الحجز). لكل قاعة رسالة مختلفة، عربي وإنجليزي.
alter table rooms add column if not exists booking_policy_message text;
alter table rooms add column if not exists booking_policy_message_en text;
