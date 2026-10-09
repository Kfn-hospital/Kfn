-- حالة جديدة للحجز: مُعاد للتعديل (يشغَّل لوحده أولًا)
alter type booking_status add value if not exists 'needs_edit';
