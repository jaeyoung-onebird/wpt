// User types
export interface User {
  id: string;
  phone: string;
  email: string | null;
  name: string;
  platform_role: "user" | "admin" | "super_admin";
  is_active: boolean;
  created_at: string;
  has_worker_profile: boolean;
  has_org_membership: boolean;
}

export interface LoginResponse {
  user: User;
  tokens: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  };
  worker_profile_id: string | null;
  org_memberships: { org_id: string; role: string }[];
}

// Worker types
export interface WorkerProfile {
  id: string;
  nickname: string;
  profile_image_url: string | null;
  region: string | null;
  work_types: string[];
  bio: string | null;
  trust_score: number;
  total_jobs: number;
  rating_avg: number;
  rating_count: number;
  no_show_count: number;
  late_count: number;
  signup_source: string;
  created_at: string;
  private_info?: WorkerPrivate;
  preferences?: WorkerPreferences;
}

export interface WorkerPrivate {
  real_name: string;
  phone: string;
  birthdate: string | null;
  gender: string | null;
  bank_name: string | null;
  bank_account: string | null;
  account_holder: string | null;
  emergency_contact: string | null;
}

export interface WorkerPreferences {
  preferred_days_per_week: number | null;
  preferred_monthly_income: number | null;
  preferred_time_slot: string | null;
  preferred_regions: string[] | null;
  preferred_work_types: string[] | null;
  unavailable_weekdays: number[] | null;
  min_hourly_rate: number | null;
  ai_recommendation_enabled: boolean;
}

// Organization types
export interface Organization {
  id: string;
  name: string;
  business_number: string;
  representative_name: string;
  business_type: string;
  address: string;
  contact_phone: string;
  contact_email: string | null;
  logo_url: string | null;
  description: string | null;
  is_verified: boolean;
  follower_count: number;
  rating_avg: number;
  rating_count: number;
  created_at: string;
}

export interface OrgMember {
  id: string;
  user_id: string;
  org_id: string;
  role: "owner" | "admin" | "manager";
  user_name: string;
  user_phone: string;
  joined_at: string;
}

// Event types
export interface Event {
  id: string;
  org_id: string;
  org_name: string;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string;
  end_time: string;
  location_name: string;
  location_address: string;
  location_lat: number | null;
  location_lng: number | null;
  dress_code: string | null;
  notes: string | null;
  status: "draft" | "published" | "in_progress" | "completed" | "cancelled";
  total_positions: number;
  filled_positions: number;
  positions: EventPosition[];
  created_at: string;
}

export interface EventPosition {
  id: string;
  title: string;
  work_type: string;
  headcount: number;
  filled_count: number;
  hourly_rate: number;
  description: string | null;
  requirements: string | null;
}

export interface EventListItem {
  id: string;
  org_id: string;
  org_name: string;
  org_logo_url: string | null;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location_name: string;
  status: string;
  total_positions: number;
  filled_positions: number;
  min_hourly_rate: number;
  max_hourly_rate: number;
  is_following_org: boolean;
}

// Application types
export interface Application {
  id: string;
  event_id: string;
  event_title: string;
  event_date: string;
  position_id: string;
  position_title: string;
  org_name: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  note: string | null;
  applied_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

// Attendance types
export interface Attendance {
  id: string;
  application_id: string;
  event_title: string;
  event_date: string;
  position_title: string;
  org_name: string;
  scheduled_start: string;
  scheduled_end: string;
  check_in_at: string | null;
  check_out_at: string | null;
  actual_minutes: number | null;
  is_late: boolean;
  late_minutes: number;
  status: "scheduled" | "checked_in" | "completed" | "early_leave" | "no_show";
  org_note: string | null;
}

// Payroll types
export interface PayrollRecord {
  id: string;
  attendance_id: string;
  event_title: string;
  event_date: string;
  org_name: string;
  work_date: string;
  worked_minutes: number;
  hourly_rate: number;
  base_pay: number;
  total_pay: number;
  payment_status: "pending" | "paid" | "disputed";
  worker_confirmed: boolean;
  worker_confirmed_at: string | null;
  paid_at: string | null;
  created_at: string;
}

// Schedule types
export interface ScheduleItem {
  date: string;
  event_id: string;
  event_title: string;
  org_name: string;
  position_title: string;
  start_time: string;
  end_time: string;
  status: string;
  hourly_rate: number;
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// Admin types
export interface UserAdmin {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  platform_role: "user" | "admin" | "super_admin";
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  has_worker_profile: boolean;
  has_org_membership: boolean;
}

export interface WorkerAdmin {
  id: string;
  user_id: string;
  nickname: string;
  profile_image_url: string | null;
  region: string | null;
  work_types: string[];
  trust_score: number;
  total_jobs: number;
  rating_avg: number;
  no_show_count: number;
  late_count: number;
  is_active: boolean;
  created_at: string;
  real_name: string | null;
  phone: string | null;
  email: string | null;
  signup_source: string;
}

export interface PlatformStats {
  total_users: number;
  total_workers: number;
  total_organizations: number;
  verified_organizations: number;
  total_events: number;
  active_events: number;
  total_applications: number;
  total_payroll_amount: number;
}

export interface DailyStats {
  date: string;
  new_users: number;
  new_workers: number;
  new_orgs: number;
  new_events: number;
  new_applications: number;
  completed_jobs: number;
  total_paid: number;
}
