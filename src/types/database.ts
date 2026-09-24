// أنواع TypeScript مطابقة لجداول قاعدة البيانات

export type UserRole = 'admin' | 'room_manager' | 'coordinator' | 'coordination_admin' | 'employee';
export type UserStatus = 'active' | 'suspended' | 'pending';
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
  rooms?: Room;
  profiles?: Profile;
}

export interface RequestCategory {
  id: string;
  name: string;
  department: string | null;
}

export interface CoordinationRequest {
  id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  created_by: string;
  assigned_to: string | null;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
  request_categories?: RequestCategory;
  assignee?: Profile;
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
  profiles?: Profile;
}

export interface ChecklistAccess {
  checklist_id: string;
  user_id: string;
  can_edit: boolean;
  profiles?: Profile;
}

export interface ChecklistAttachment {
  id: string;
  checklist_id: string;
  file_name: string;
  file_path: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface SharedFile {
  id: string;
  file_name: string;
  file_path: string;
  pdf_path: string | null;
  file_name_en: string | null;
  uploaded_by: string;
  uploaded_at: string;
  profiles?: Profile;
}
