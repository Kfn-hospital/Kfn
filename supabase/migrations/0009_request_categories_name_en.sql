-- إضافة اسم إنجليزي اختياري لتصنيفات طلبات التنسيق والمتابعة
alter table request_categories add column if not exists name_en text;
