-- =====================================================
-- WorkProof Chain v2 - Database Schema
-- Version: 1.0.0
-- Tables: 25
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. ACCOUNTS (4 tables)
-- =====================================================

-- 1.1 Users (사용자 계정)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(50) NOT NULL,
    platform_role VARCHAR(20) DEFAULT 'user' CHECK (platform_role IN ('user', 'admin', 'super_admin')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

COMMENT ON COLUMN users.platform_role IS '플랫폼 역할: user=일반유저, admin=관리자, super_admin=최고관리자';

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_email ON users(email);

-- 1.2 Organizations (업체)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    business_number VARCHAR(20) UNIQUE,
    business_type VARCHAR(50),
    region VARCHAR(50),
    plan VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'pro', 'enterprise')),
    invite_code VARCHAR(20) UNIQUE NOT NULL,
    invite_link_enabled BOOLEAN DEFAULT true,
    rating_avg DECIMAL(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_organizations_invite_code ON organizations(invite_code);
CREATE INDEX idx_organizations_region ON organizations(region);

-- 1.3 Org Members (업체 멤버)
CREATE TABLE org_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'viewer')),
    invited_by UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_members_org ON org_members(org_id);
CREATE INDEX idx_org_members_user ON org_members(user_id);

-- 1.4 Invites (초대)
CREATE TABLE invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invite_type VARCHAR(20) NOT NULL CHECK (invite_type IN ('org_member', 'worker')),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255),
    phone VARCHAR(20),
    role VARCHAR(20),
    token VARCHAR(100) UNIQUE NOT NULL,
    invited_by UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_invites_token ON invites(token);
CREATE INDEX idx_invites_org ON invites(org_id);
CREATE INDEX idx_invites_status ON invites(status);

-- =====================================================
-- 2. WORKERS (2 tables)
-- =====================================================

-- 2.1 Workers Public (근로자 공개 프로필)
CREATE TABLE workers_public (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    nickname VARCHAR(50) NOT NULL,
    profile_image_url VARCHAR(500),
    region VARCHAR(50),
    work_types VARCHAR[] DEFAULT '{}',
    bio TEXT,
    trust_score DECIMAL(3,2) DEFAULT 3.00 CHECK (trust_score >= 0 AND trust_score <= 5),
    total_jobs INTEGER DEFAULT 0,
    rating_avg DECIMAL(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    no_show_count INTEGER DEFAULT 0,
    late_count INTEGER DEFAULT 0,
    signup_source VARCHAR(20) NOT NULL CHECK (signup_source IN ('direct', 'org_invited')),
    invited_by_org_id UUID REFERENCES organizations(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_workers_public_user ON workers_public(user_id);
CREATE INDEX idx_workers_public_region ON workers_public(region);
CREATE INDEX idx_workers_public_trust ON workers_public(trust_score DESC);

-- 2.2 Workers Private (근로자 비공개 정보)
CREATE TABLE workers_private (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID NOT NULL REFERENCES workers_public(id) ON DELETE CASCADE UNIQUE,
    real_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    birthdate DATE,
    gender VARCHAR(10),
    bank_name VARCHAR(50),
    bank_account VARCHAR(50),
    account_holder VARCHAR(50),
    emergency_contact VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_workers_private_worker ON workers_private(worker_id);

-- =====================================================
-- 3. FOLLOW/BLOCK (4 tables)
-- =====================================================

-- 3.1 Org -> Worker Follow (업체 → 근로자 팔로우)
CREATE TABLE org_worker_follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES workers_public(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, worker_id)
);

CREATE INDEX idx_org_worker_follows_org ON org_worker_follows(org_id);
CREATE INDEX idx_org_worker_follows_worker ON org_worker_follows(worker_id);

-- 3.2 Worker -> Org Follow (근로자 → 업체 팔로우)
CREATE TABLE worker_org_follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID NOT NULL REFERENCES workers_public(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(worker_id, org_id)
);

CREATE INDEX idx_worker_org_follows_worker ON worker_org_follows(worker_id);
CREATE INDEX idx_worker_org_follows_org ON worker_org_follows(org_id);

-- 3.3 Org -> Worker Block (업체 → 근로자 차단)
CREATE TABLE org_worker_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES workers_public(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, worker_id)
);

CREATE INDEX idx_org_worker_blocks_org ON org_worker_blocks(org_id);
CREATE INDEX idx_org_worker_blocks_worker ON org_worker_blocks(worker_id);

-- 3.4 Worker -> Org Block (근로자 → 업체 차단)
CREATE TABLE worker_org_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID NOT NULL REFERENCES workers_public(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(worker_id, org_id)
);

CREATE INDEX idx_worker_org_blocks_worker ON worker_org_blocks(worker_id);
CREATE INDEX idx_worker_org_blocks_org ON worker_org_blocks(org_id);

-- =====================================================
-- 4. WORK RELATIONSHIP (1 table)
-- =====================================================

-- 4.1 Work History (근무 이력)
CREATE TABLE work_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES workers_public(id) ON DELETE CASCADE,
    total_jobs INTEGER DEFAULT 0,
    first_worked_at TIMESTAMPTZ,
    last_worked_at TIMESTAMPTZ,
    org_memo TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, worker_id)
);

CREATE INDEX idx_work_history_org ON work_history(org_id);
CREATE INDEX idx_work_history_worker ON work_history(worker_id);

-- =====================================================
-- 5. EVENTS (3 tables)
-- =====================================================

-- 5.1 Events (이벤트)
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_type VARCHAR(50),
    venue_name VARCHAR(200),
    venue_address VARCHAR(500),
    venue_region VARCHAR(50),
    work_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT now(),
    published_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
);

CREATE INDEX idx_events_org ON events(org_id);
CREATE INDEX idx_events_date ON events(work_date);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_region ON events(venue_region);

-- 5.2 Event Positions (이벤트 포지션)
CREATE TABLE event_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    required_count INTEGER NOT NULL CHECK (required_count > 0),
    confirmed_count INTEGER DEFAULT 0,
    hourly_rate INTEGER NOT NULL CHECK (hourly_rate > 0),
    UNIQUE(event_id, name)
);

CREATE INDEX idx_event_positions_event ON event_positions(event_id);

-- 5.3 Applications (지원)
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES event_positions(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES workers_public(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'completed', 'no_show')),
    applied_at TIMESTAMPTZ DEFAULT now(),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    UNIQUE(event_id, worker_id)
);

CREATE INDEX idx_applications_event ON applications(event_id);
CREATE INDEX idx_applications_worker ON applications(worker_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_position ON applications(position_id);

-- =====================================================
-- 6. ATTENDANCE/PAYROLL (2 tables)
-- =====================================================

-- 6.1 Attendance (출석)
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE UNIQUE,
    scheduled_start TIME NOT NULL,
    scheduled_end TIME NOT NULL,
    check_in_at TIMESTAMPTZ,
    check_out_at TIMESTAMPTZ,
    actual_minutes INTEGER,
    is_late BOOLEAN DEFAULT false,
    late_minutes INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'checked_in', 'completed', 'early_leave', 'no_show')),
    org_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_attendance_application ON attendance(application_id);
CREATE INDEX idx_attendance_status ON attendance(status);

-- 6.2 Payroll Records (급여)
CREATE TABLE payroll_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attendance_id UUID NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES workers_public(id),
    org_id UUID NOT NULL REFERENCES organizations(id),
    event_id UUID NOT NULL REFERENCES events(id),
    work_date DATE NOT NULL,
    worked_minutes INTEGER NOT NULL,
    hourly_rate INTEGER NOT NULL,
    base_pay INTEGER NOT NULL,
    total_pay INTEGER NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'disputed')),
    worker_confirmed BOOLEAN DEFAULT false,
    worker_confirmed_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payroll_worker ON payroll_records(worker_id);
CREATE INDEX idx_payroll_org ON payroll_records(org_id);
CREATE INDEX idx_payroll_date ON payroll_records(work_date);
CREATE INDEX idx_payroll_status ON payroll_records(payment_status);

-- =====================================================
-- 7. NOTIFICATIONS (1 table)
-- =====================================================

-- 7.1 Notifications (알림)
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- =====================================================
-- 8. AI/SCHEDULE (3 tables)
-- =====================================================

-- 8.1 Worker Preferences (근로자 선호 설정)
CREATE TABLE worker_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID NOT NULL REFERENCES workers_public(id) ON DELETE CASCADE UNIQUE,
    preferred_days_per_week INTEGER CHECK (preferred_days_per_week >= 1 AND preferred_days_per_week <= 7),
    preferred_monthly_income INTEGER,
    preferred_time_slot VARCHAR(20) CHECK (preferred_time_slot IN ('morning', 'afternoon', 'evening', 'flexible')),
    preferred_regions VARCHAR[],
    preferred_work_types VARCHAR[],
    unavailable_weekdays INTEGER[],
    min_hourly_rate INTEGER,
    ai_recommendation_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_worker_preferences_worker ON worker_preferences(worker_id);

-- 8.2 Worker Unavailable Dates (불가 날짜)
CREATE TABLE worker_unavailable_dates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID NOT NULL REFERENCES workers_public(id) ON DELETE CASCADE,
    unavailable_date DATE NOT NULL,
    reason VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(worker_id, unavailable_date)
);

CREATE INDEX idx_worker_unavailable_worker ON worker_unavailable_dates(worker_id);
CREATE INDEX idx_worker_unavailable_date ON worker_unavailable_dates(unavailable_date);

-- 8.3 AI Recommendations (AI 추천 로그)
CREATE TABLE ai_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID NOT NULL REFERENCES workers_public(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    match_score DECIMAL(5,2) NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
    score_factors JSONB,
    recommended_at TIMESTAMPTZ DEFAULT now(),
    user_action VARCHAR(20) CHECK (user_action IN ('applied', 'dismissed', 'ignored')),
    action_at TIMESTAMPTZ,
    UNIQUE(worker_id, event_id)
);

CREATE INDEX idx_ai_recommendations_worker ON ai_recommendations(worker_id);
CREATE INDEX idx_ai_recommendations_event ON ai_recommendations(event_id);
CREATE INDEX idx_ai_recommendations_score ON ai_recommendations(match_score DESC);

-- =====================================================
-- 9. BIG DATA (5 tables)
-- =====================================================

-- 9.1 Behavior Logs (행동 로그)
CREATE TABLE behavior_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_type VARCHAR(20),
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_behavior_logs_created ON behavior_logs(created_at);
CREATE INDEX idx_behavior_logs_user_action ON behavior_logs(user_id, action);
CREATE INDEX idx_behavior_logs_target ON behavior_logs(target_type, target_id);

-- 9.2 Matching Outcomes (매칭 결과)
CREATE TABLE matching_outcomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES workers_public(id),
    org_id UUID NOT NULL REFERENCES organizations(id),
    event_id UUID NOT NULL REFERENCES events(id),
    worker_trust_score_at_match DECIMAL(3,2),
    worker_total_jobs_at_match INTEGER,
    match_score_at_recommendation DECIMAL(5,2),
    was_ai_recommended BOOLEAN DEFAULT false,
    application_status VARCHAR(20),
    was_accepted BOOLEAN,
    was_completed BOOLEAN,
    was_no_show BOOLEAN,
    org_rating_given DECIMAL(3,2),
    worker_rating_given DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_matching_outcomes_worker ON matching_outcomes(worker_id);
CREATE INDEX idx_matching_outcomes_org ON matching_outcomes(org_id);
CREATE INDEX idx_matching_outcomes_completed ON matching_outcomes(was_completed);

-- 9.3 Market Trends Daily (일별 시장 트렌드)
CREATE TABLE market_trends_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    region VARCHAR(50),
    work_type VARCHAR(50),
    total_events INTEGER DEFAULT 0,
    total_positions INTEGER DEFAULT 0,
    avg_hourly_rate INTEGER,
    total_applications INTEGER DEFAULT 0,
    avg_applications_per_position DECIMAL(5,2),
    total_matches INTEGER DEFAULT 0,
    match_rate DECIMAL(5,4),
    total_completed INTEGER DEFAULT 0,
    completion_rate DECIMAL(5,4),
    no_show_rate DECIMAL(5,4),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(date, region, work_type)
);

CREATE INDEX idx_market_trends_date ON market_trends_daily(date);
CREATE INDEX idx_market_trends_region ON market_trends_daily(region);

-- 9.4 Worker Metrics Monthly (근로자 월별 지표)
CREATE TABLE worker_metrics_monthly (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID NOT NULL REFERENCES workers_public(id) ON DELETE CASCADE,
    year_month DATE NOT NULL,
    events_applied INTEGER DEFAULT 0,
    events_accepted INTEGER DEFAULT 0,
    events_completed INTEGER DEFAULT 0,
    events_no_show INTEGER DEFAULT 0,
    events_cancelled INTEGER DEFAULT 0,
    total_earnings INTEGER DEFAULT 0,
    total_hours_worked DECIMAL(6,2) DEFAULT 0,
    avg_hourly_earned INTEGER,
    avg_rating_received DECIMAL(3,2),
    ratings_count INTEGER DEFAULT 0,
    recommendations_shown INTEGER DEFAULT 0,
    recommendations_applied INTEGER DEFAULT 0,
    recommendations_dismissed INTEGER DEFAULT 0,
    recommendation_conversion_rate DECIMAL(5,4),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(worker_id, year_month)
);

CREATE INDEX idx_worker_metrics_worker ON worker_metrics_monthly(worker_id);
CREATE INDEX idx_worker_metrics_month ON worker_metrics_monthly(year_month);

-- 9.5 Org Metrics Monthly (업체 월별 지표)
CREATE TABLE org_metrics_monthly (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    year_month DATE NOT NULL,
    events_created INTEGER DEFAULT 0,
    events_completed INTEGER DEFAULT 0,
    events_cancelled INTEGER DEFAULT 0,
    total_positions_needed INTEGER DEFAULT 0,
    total_positions_filled INTEGER DEFAULT 0,
    fill_rate DECIMAL(5,4),
    applications_received INTEGER DEFAULT 0,
    applications_accepted INTEGER DEFAULT 0,
    acceptance_rate DECIMAL(5,4),
    total_no_shows INTEGER DEFAULT 0,
    no_show_rate DECIMAL(5,4),
    total_labor_cost INTEGER DEFAULT 0,
    avg_hourly_rate_paid INTEGER,
    avg_rating_given DECIMAL(3,2),
    avg_rating_received DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(org_id, year_month)
);

CREATE INDEX idx_org_metrics_org ON org_metrics_monthly(org_id);
CREATE INDEX idx_org_metrics_month ON org_metrics_monthly(year_month);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_workers_public_updated_at
    BEFORE UPDATE ON workers_public
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workers_private_updated_at
    BEFORE UPDATE ON workers_private
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_work_history_updated_at
    BEFORE UPDATE ON work_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_worker_preferences_updated_at
    BEFORE UPDATE ON worker_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function: Generate random invite code
CREATE OR REPLACE FUNCTION generate_invite_code(length INTEGER DEFAULT 8)
RETURNS VARCHAR AS $$
DECLARE
    chars VARCHAR := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result VARCHAR := '';
    i INTEGER;
BEGIN
    FOR i IN 1..length LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE users IS '사용자 계정 (업체 멤버 + 근로자 공통)';
COMMENT ON TABLE organizations IS '업체 정보';
COMMENT ON TABLE org_members IS '업체 멤버 (역할: owner/admin/manager/viewer)';
COMMENT ON TABLE invites IS '초대 (업체 멤버 초대, 근로자 초대)';
COMMENT ON TABLE workers_public IS '근로자 공개 프로필';
COMMENT ON TABLE workers_private IS '근로자 비공개 정보 (개인정보)';
COMMENT ON TABLE org_worker_follows IS '업체 → 근로자 팔로우';
COMMENT ON TABLE worker_org_follows IS '근로자 → 업체 팔로우';
COMMENT ON TABLE org_worker_blocks IS '업체 → 근로자 차단';
COMMENT ON TABLE worker_org_blocks IS '근로자 → 업체 차단';
COMMENT ON TABLE work_history IS '업체-근로자 근무 이력';
COMMENT ON TABLE events IS '이벤트 (행사/일자리)';
COMMENT ON TABLE event_positions IS '이벤트 포지션 (모집 직종)';
COMMENT ON TABLE applications IS '지원';
COMMENT ON TABLE attendance IS '출석';
COMMENT ON TABLE payroll_records IS '급여 기록';
COMMENT ON TABLE notifications IS '알림';
COMMENT ON TABLE worker_preferences IS '근로자 선호 설정 (AI 매칭용)';
COMMENT ON TABLE worker_unavailable_dates IS '근로자 불가 날짜';
COMMENT ON TABLE ai_recommendations IS 'AI 추천 로그';
COMMENT ON TABLE behavior_logs IS '행동 로그 (빅데이터)';
COMMENT ON TABLE matching_outcomes IS '매칭 결과 (빅데이터)';
COMMENT ON TABLE market_trends_daily IS '일별 시장 트렌드 (빅데이터)';
COMMENT ON TABLE worker_metrics_monthly IS '근로자 월별 지표 (빅데이터)';
COMMENT ON TABLE org_metrics_monthly IS '업체 월별 지표 (빅데이터)';

-- =====================================================
-- END OF SCHEMA
-- =====================================================
