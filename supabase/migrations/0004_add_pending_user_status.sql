-- إضافة قيمة 'pending' لنوع user_status الحالي (عملية آمنة 100%، مش
-- هتأثر على أي بيانات أو مستخدمين موجودين بالفعل، وبترجع فورًا)
ALTER TYPE public.user_status ADD VALUE IF NOT EXISTS 'pending';
