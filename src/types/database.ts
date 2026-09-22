// أنواع TypeScript مطابقة لجداول قاعدة البيانات

export type UserRole = 'admin' | 'room_manager' | 'coordinator' | 'employee';
export type UserStatus = 'active' | 'suspended';
export type BookingStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type RequestStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';

export interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  department: string | null;
  status: UserStatus;
  created_at: string;
}

export interface Room {
  id: string;
  name: string;
  name_en: string | null;
  location: string | null;
  location_en: string | null;
  capacity: number;
  status: string;
}

export interface Booking {
  id: string;
  room_id: string;
  booked_by: string;
  title: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  notes: string | null;
  created_at: string;
}

export interface Checklist {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  item_text: string;
  created_at: string;
}

export interface ChecklistAssignment {
  id: string;
  item_id: string;
  checklist_id: string;
  assigned_to: string;
  is_done: boolean;
  done_at: string | null;
}
