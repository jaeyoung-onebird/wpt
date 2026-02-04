-- WorkProof Work OS: BigData & Gamification Schema
-- Created: 2026-02-04

-- ============================================
-- 1. Worker Metrics (근무자 성과 지표)
-- ============================================
CREATE TABLE IF NOT EXISTS worker_metrics (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,

    -- 출석 관련
    total_events INTEGER DEFAULT 0,
    completed_events INTEGER DEFAULT 0,
    cancelled_events INTEGER DEFAULT 0,
    noshow_events INTEGER DEFAULT 0,
    late_count INTEGER DEFAULT 0,

    -- 신뢰도
    reliability_score DECIMAL(5,2) DEFAULT 0.0, -- 0-100
    avg_rating DECIMAL(3,2) DEFAULT 0.0, -- 0-5

    -- 수입
    total_income DECIMAL(12,2) DEFAULT 0.0,
    avg_daily_income DECIMAL(10,2) DEFAULT 0.0,

    -- WPT
    total_wpt_earned INTEGER DEFAULT 0,
    total_wpt_spent INTEGER DEFAULT 0,
    wpt_balance INTEGER DEFAULT 0,

    -- 레벨/경험치
    level INTEGER DEFAULT 1,
    experience_points INTEGER DEFAULT 0,

    -- 통계 기간
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(worker_id)
);

CREATE INDEX idx_worker_metrics_score ON worker_metrics(reliability_score DESC);
CREATE INDEX idx_worker_metrics_level ON worker_metrics(level DESC);


-- ============================================
-- 2. Worker Streaks (연속 출석)
-- ============================================
CREATE TABLE IF NOT EXISTS worker_streaks (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,

    current_streak INTEGER DEFAULT 0, -- 현재 연속 출석일
    longest_streak INTEGER DEFAULT 0, -- 최장 기록
    last_checkin_date DATE,

    -- 보상
    streak_bonus_wpt INTEGER DEFAULT 0, -- 받은 보너스 WPT

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(worker_id)
);


-- ============================================
-- 3. WPT Transactions (토큰 거래 내역)
-- ============================================
CREATE TABLE IF NOT EXISTS wpt_transactions (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,

    type VARCHAR(50) NOT NULL, -- EARN, SPEND, BURN, ADMIN_GRANT
    category VARCHAR(100) NOT NULL, -- checkin, attendance, nft_purchase, ai_recommendation

    amount INTEGER NOT NULL, -- + or -
    balance_after INTEGER NOT NULL,

    -- 관련 데이터
    reference_type VARCHAR(50), -- attendance, event, nft
    reference_id INTEGER,

    description TEXT,
    metadata JSONB, -- 추가 데이터

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wpt_worker ON wpt_transactions(worker_id, created_at DESC);
CREATE INDEX idx_wpt_type ON wpt_transactions(type, created_at DESC);


-- ============================================
-- 4. Attendance Stats (출석 통계)
-- ============================================
CREATE TABLE IF NOT EXISTS attendance_stats (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,

    -- 출석
    total_days INTEGER DEFAULT 0,
    present_days INTEGER DEFAULT 0,
    late_days INTEGER DEFAULT 0,
    absent_days INTEGER DEFAULT 0,

    -- 시간
    total_work_hours DECIMAL(10,2) DEFAULT 0.0,
    avg_work_hours DECIMAL(5,2) DEFAULT 0.0,

    -- 수입
    total_income DECIMAL(12,2) DEFAULT 0.0,
    total_wpt_earned INTEGER DEFAULT 0,

    -- 평가
    avg_rating DECIMAL(3,2) DEFAULT 0.0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(worker_id, year, month)
);

CREATE INDEX idx_attendance_stats_period ON attendance_stats(year DESC, month DESC);


-- ============================================
-- 5. AI Matching Logs (AI 매칭 로그)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_matching_logs (
    id SERIAL PRIMARY KEY,

    -- 매칭 주체
    initiated_by VARCHAR(50) NOT NULL, -- worker, admin
    worker_id INTEGER REFERENCES workers(id),
    admin_id INTEGER,

    -- 매칭 대상
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,

    -- 점수
    match_score DECIMAL(5,2), -- 0-100
    distance_score DECIMAL(5,2),
    reliability_score DECIMAL(5,2),
    pay_score DECIMAL(5,2),
    skill_score DECIMAL(5,2),

    -- 결과
    was_recommended BOOLEAN DEFAULT FALSE,
    was_applied BOOLEAN DEFAULT FALSE,
    was_accepted BOOLEAN DEFAULT FALSE,

    -- WPT 차감 (기업용 기능)
    wpt_charged INTEGER DEFAULT 0,

    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_matching_event ON ai_matching_logs(event_id, match_score DESC);
CREATE INDEX idx_matching_worker ON ai_matching_logs(worker_id, created_at DESC);


-- ============================================
-- 6. Worker Levels (레벨 시스템)
-- ============================================
CREATE TABLE IF NOT EXISTS worker_levels (
    level INTEGER PRIMARY KEY,
    required_exp INTEGER NOT NULL,
    title VARCHAR(100) NOT NULL,
    benefits JSONB, -- {"wpt_boost": 1.1, "priority": true}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 레벨 데이터 초기화
INSERT INTO worker_levels (level, required_exp, title, benefits) VALUES
(1, 0, '신입', '{"wpt_boost": 1.0}'),
(2, 100, '일꾼', '{"wpt_boost": 1.05}'),
(3, 300, '숙련공', '{"wpt_boost": 1.1}'),
(4, 700, '베테랑', '{"wpt_boost": 1.15, "priority": true}'),
(5, 1500, '프로', '{"wpt_boost": 1.2, "priority": true}'),
(6, 3000, '마스터', '{"wpt_boost": 1.3, "priority": true, "featured": true}'),
(7, 5000, '레전드', '{"wpt_boost": 1.5, "priority": true, "featured": true, "exclusive": true}')
ON CONFLICT (level) DO NOTHING;


-- ============================================
-- 7. Event Analytics (행사 분석)
-- ============================================
CREATE TABLE IF NOT EXISTS event_analytics (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,

    -- 지원
    total_applications INTEGER DEFAULT 0,
    confirmed_count INTEGER DEFAULT 0,
    rejection_count INTEGER DEFAULT 0,

    -- 출석
    total_attendance INTEGER DEFAULT 0,
    late_count INTEGER DEFAULT 0,
    absent_count INTEGER DEFAULT 0,

    -- 성과
    completion_rate DECIMAL(5,2) DEFAULT 0.0,
    avg_worker_rating DECIMAL(3,2) DEFAULT 0.0,
    total_cost DECIMAL(12,2) DEFAULT 0.0,

    -- AI 사용
    ai_recommendations_used INTEGER DEFAULT 0,
    wpt_spent INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(event_id)
);


-- ============================================
-- 8. System Config (시스템 설정)
-- ============================================
CREATE TABLE IF NOT EXISTS gamification_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 기본 설정 초기화
INSERT INTO gamification_config (key, value, description) VALUES
('wpt_rewards', '{
    "checkin": 10,
    "checkout": 10,
    "streak_bonus": 5,
    "complete_event": 50,
    "perfect_attendance": 100
}', 'WPT 보상 금액'),

('wpt_costs', '{
    "nft_badge_basic": 100,
    "nft_badge_rare": 500,
    "nft_badge_epic": 1000,
    "ai_recommendation": 20,
    "featured_listing": 50,
    "priority_match": 30
}', 'WPT 소비 금액'),

('level_exp', '{
    "event_complete": 10,
    "perfect_attendance": 20,
    "high_rating": 15
}', '경험치 획득'),

('ai_weights', '{
    "distance": 0.25,
    "reliability": 0.30,
    "pay": 0.20,
    "skill": 0.15,
    "availability": 0.10
}', 'AI 매칭 가중치')

ON CONFLICT (key) DO NOTHING;


-- ============================================
-- Functions & Triggers
-- ============================================

-- Worker Metrics 자동 업데이트
CREATE OR REPLACE FUNCTION update_worker_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- attendance 테이블에 변화가 생기면 metrics 업데이트
    INSERT INTO worker_metrics (worker_id, total_events, completed_events)
    VALUES (NEW.worker_id, 1, CASE WHEN NEW.check_out_time IS NOT NULL THEN 1 ELSE 0 END)
    ON CONFLICT (worker_id)
    DO UPDATE SET
        total_events = worker_metrics.total_events + 1,
        completed_events = worker_metrics.completed_events + CASE WHEN NEW.check_out_time IS NOT NULL THEN 1 ELSE 0 END,
        last_updated = CURRENT_TIMESTAMP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_worker_metrics
AFTER INSERT OR UPDATE ON attendance
FOR EACH ROW EXECUTE FUNCTION update_worker_metrics();


-- WPT Balance 업데이트
CREATE OR REPLACE FUNCTION update_wpt_balance()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE worker_metrics
    SET wpt_balance = wpt_balance + NEW.amount,
        total_wpt_earned = CASE WHEN NEW.amount > 0 THEN total_wpt_earned + NEW.amount ELSE total_wpt_earned END,
        total_wpt_spent = CASE WHEN NEW.amount < 0 THEN total_wpt_spent + ABS(NEW.amount) ELSE total_wpt_spent END
    WHERE worker_id = NEW.worker_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_wpt_balance
AFTER INSERT ON wpt_transactions
FOR EACH ROW EXECUTE FUNCTION update_wpt_balance();


-- 초기 Metrics 생성 (기존 workers용)
INSERT INTO worker_metrics (worker_id)
SELECT id FROM workers
WHERE id NOT IN (SELECT worker_id FROM worker_metrics);

INSERT INTO worker_streaks (worker_id)
SELECT id FROM workers
WHERE id NOT IN (SELECT worker_id FROM worker_streaks);
