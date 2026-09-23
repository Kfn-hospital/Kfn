-- ============================================================
-- بوابة خورفكان الإدارية — مخطط قاعدة البيانات الكامل (Supabase/PostgreSQL)
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- 1) المستخدمون
-- ============================================================
create type user_role as enum ('admin', 'room_manager', 'coordinator', 'employee');
create type user_status as enum ('active', 'suspended');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text unique not null,
  phone text unique,
  role user_role not null default 'employee',
  department text,
  status user_status not null default 'active',
  created_at timestamptz not null default now()
);
create index idx_profiles_phone on profiles(phone);
create index idx_profiles_role on profiles(role);

-- ============================================================
-- 2) القاعات
-- ============================================================
create table rooms (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  name_en text,
  location text,
  location_en text,
  capacity int not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table room_managers (
  room_id uuid references rooms(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key (room_id, user_id)
);

-- ============================================================
-- 3) الحجوزات
-- ============================================================
create type booking_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create table bookings (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references rooms(id),
  booked_by uuid not null references profiles(id),
  title text not null,
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  status booking_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);
create index idx_bookings_room_date on bookings(room_id, booking_date);
create index idx_bookings_status on bookings(status);

-- ============================================================
-- 4) طلبات التنسيق والمتابعة
-- ============================================================
create type request_status as enum ('pending', 'in_progress', 'completed', 'rejected');

create table request_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  department text
);

create table requests (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  category_id uuid references request_categories(id),
  created_by uuid not null references profiles(id),
  assigned_to uuid references profiles(id),
  status request_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_requests_status on requests(status);
create index idx_requests_assigned on requests(assigned_to);

-- ============================================================
-- 5) قوائم التحقق (Checklists)
-- ============================================================
create table checklists (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  created_by uuid not null references profiles(id),
  start_date date,
  end_date date,
  notes text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table checklist_items (
  id uuid primary key default uuid_generate_v4(),
  checklist_id uuid not null references checklists(id) on delete cascade,
  item_text text not null,
  created_at timestamptz not null default now()
);

create table checklist_assignments (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references checklist_items(id) on delete cascade,
  checklist_id uuid not null references checklists(id) on delete cascade,
  assigned_to uuid not null references profiles(id),
  is_done boolean not null default false,
  done_at timestamptz
);
create index idx_checklist_assignments_user on checklist_assignments(assigned_to);

create table checklist_access (
  checklist_id uuid references checklists(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  can_edit boolean not null default false,
  primary key (checklist_id, user_id)
);

create table checklist_attachments (
  id uuid primary key default uuid_generate_v4(),
  checklist_id uuid not null references checklists(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  uploaded_by uuid not null references profiles(id),
  uploaded_at timestamptz not null default now()
);

-- ============================================================
-- 6) ملفات ومستندات مشتركة
-- ============================================================
create table shared_files (
  id uuid primary key default uuid_generate_v4(),
  file_name text not null,
  file_path text not null,
  pdf_path text,
  uploaded_by uuid not null references profiles(id),
  uploaded_at timestamptz not null default now()
);

-- ============================================================
-- 7) الإعدادات العامة
-- ============================================================
create table app_settings (
  key text primary key,
  value text
);

create table checklist_creators (
  user_id uuid primary key references profiles(id) on delete cascade
);

create table file_uploaders (
  user_id uuid primary key references profiles(id) on delete cascade
);

-- ============================================================
-- 8) سجل التدقيق
-- ============================================================
create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  action text not null,
  details text,
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_audit_log_created on audit_log(created_at desc);

-- ============================================================
-- تحديث updated_at تلقائيًا
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_requests_updated_at
  before update on requests
  for each row execute function set_updated_at();
