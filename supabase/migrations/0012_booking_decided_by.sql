-- مين اللي اعتمد/رفض الحجز (مسؤول القاعة أو الأدمن)
alter table bookings add column if not exists decided_by uuid;
