import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { nftAPI, badgesAPI } from '../api/client';

// 등급별 스타일
const GRADE_STYLES = {
  COMMON: { bg: '#F3F4F6', text: '#6B7280' },
  RARE: { bg: '#DBEAFE', text: '#2563EB' },
  EPIC: { bg: '#E9D5FF', text: '#7C3AED' },
  LEGENDARY: { bg: '#FEF3C7', text: '#D97706' },
};

const GRADE_LABELS = {
  COMMON: '일반',
  RARE: '희귀',
  EPIC: '영웅',
  LEGENDARY: '전설',
};

// 배지 유형별 등급 매핑
const BADGE_GRADES = {
  WORK_COUNT: { 1: 'COMMON', 2: 'RARE', 3: 'EPIC', 4: 'LEGENDARY' },
  TRUST: { 1: 'RARE', 2: 'EPIC', 3: 'LEGENDARY' },
  BLOCKCHAIN: { 1: 'COMMON', 2: 'RARE', 3: 'EPIC' },
  PROFILE: { 1: 'COMMON' },
  PHOTO: { 1: 'COMMON' },
  PROJECT: { 1: 'RARE' },
};

// 배지 타입별 컬러풀한 그라데이션 스타일
const BADGE_TYPE_COLORS = {
  PHOTO: { gradient: 'linear-gradient(135deg, #00D9FF 0%, #00B4D8 100%)', icon: '📷' },
  PROFILE: { gradient: 'linear-gradient(135deg, #FF6B9D 0%, #C44569 100%)', icon: '👤' },
  WORK_COUNT: {
    1: { gradient: 'linear-gradient(135deg, #48BB78 0%, #2F855A 100%)', icon: '1' },
    2: { gradient: 'linear-gradient(135deg, #63B3ED 0%, #3182CE 100%)', icon: '★' },
    3: { gradient: 'linear-gradient(135deg, #9F7AEA 0%, #6B46C1 100%)', icon: '✦' },
    4: { gradient: 'linear-gradient(135deg, #F6E05E 0%, #D69E2E 100%)', icon: '✴' },
  },
  TRUST: {
    1: { gradient: 'linear-gradient(135deg, #38B2AC 0%, #2C7A7B 100%)', icon: '✓' },
    2: { gradient: 'linear-gradient(135deg, #667EEA 0%, #5A67D8 100%)', icon: '⬡' },
    3: { gradient: 'linear-gradient(135deg, #F6AD55 0%, #DD6B20 100%)', icon: '♔' },
  },
  BLOCKCHAIN: {
    1: { gradient: 'linear-gradient(135deg, #718096 0%, #4A5568 100%)', icon: '◇' },
    2: { gradient: 'linear-gradient(135deg, #4FD1C5 0%, #319795 100%)', icon: '⬢' },
    3: { gradient: 'linear-gradient(135deg, #ED64A6 0%, #97266D 100%)', icon: '◈' },
  },
  PROJECT: { gradient: 'linear-gradient(135deg, #F6AD55 0%, #3182CE 100%)', icon: 'P' },
};

function getBadgeGrade(badgeType, badgeLevel) {
  return BADGE_GRADES[badgeType]?.[badgeLevel] || 'COMMON';
}

function getBadgeTypeStyle(badgeType, badgeLevel) {
  const typeColors = BADGE_TYPE_COLORS[badgeType];
  if (!typeColors) {
    return { gradient: 'linear-gradient(135deg, #A0AEC0 0%, #718096 100%)', icon: '●' };
  }
  if (typeof typeColors === 'object' && typeColors[badgeLevel]) {
    return typeColors[badgeLevel];
  }
  return typeColors;
}

export default function Collection() {
  const { user, worker } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [badges, setBadges] = useState([]);
  const [nextBadge, setNextBadge] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // all, achievement, project
  const [sortBy, setSortBy] = useState('recent'); // recent, grade

  useEffect(() => {
    window.scrollTo(0, 0);
    if (worker) {
      loadBadges();
    } else {
      setLoading(false);
    }
  }, [worker]);

  const loadBadges = async () => {
    try {
      // nftAPI를 사용하여 배지 로드 (badgesAPI와의 불일치 문제 해결)
      const { data } = await nftAPI.getMyBadges();
      setBadges(data.badges || []);
      setNextBadge(data.next_badge);
    } catch (error) {
      console.error('Failed to load badges:', error);
      // fallback to badgesAPI
      try {
        const { data } = await badgesAPI.getMyBadges();
        setBadges(data.badges || []);
      } catch (e) {
        console.error('Fallback also failed:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  // 필터링
  const filteredBadges = badges.filter(badge => {
    if (activeTab === 'achievement') return badge.badge_type !== 'PROJECT';
    if (activeTab === 'project') return badge.badge_type === 'PROJECT';
    return true;
  });

  // 정렬
  const sortedBadges = [...filteredBadges].sort((a, b) => {
    if (sortBy === 'grade') {
      const gradeOrder = { LEGENDARY: 0, EPIC: 1, RARE: 2, COMMON: 3 };
      const gradeA = getBadgeGrade(a.badge_type, a.badge_level);
      const gradeB = getBadgeGrade(b.badge_type, b.badge_level);
      return gradeOrder[gradeA] - gradeOrder[gradeB];
    }
    return new Date(b.earned_at) - new Date(a.earned_at);
  });

  // 통계 계산
  const stats = {
    total: badges.length,
    legendary: badges.filter(b => getBadgeGrade(b.badge_type, b.badge_level) === 'LEGENDARY').length,
    epic: badges.filter(b => getBadgeGrade(b.badge_type, b.badge_level) === 'EPIC').length,
    rare: badges.filter(b => getBadgeGrade(b.badge_type, b.badge_level) === 'RARE').length,
  };

  if (!user) {
    return (
      <div className="p-4 animate-fade-in">
        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: 'var(--color-bg)' }}>
            🔒
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text-title)' }}>로그인이 필요합니다</p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-sub)' }}>컬렉션을 확인하려면 로그인해주세요</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            로그인하기
          </button>
        </div>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="p-4 animate-fade-in">
        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: 'var(--color-bg)' }}>
            🏅
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text-title)' }}>회원등록이 필요합니다</p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-sub)' }}>배지를 모으려면 회원등록을 완료해주세요</p>
          <button
            onClick={() => navigate('/register')}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            회원등록
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* 헤더 */}
      <div className="pt-2">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-title)' }}>컬렉션</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-sub)' }}>총 {badges.length}개의 배지</p>
      </div>

      {/* 통계 카드 */}
      <div className="card" style={{ background: 'linear-gradient(135deg, var(--color-navy) 0%, var(--color-navy-light) 100%)' }}>
        <div className="flex items-center justify-around py-2">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-white/60">전체</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-300">{stats.legendary}</p>
            <p className="text-xs text-white/60">전설</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-300">{stats.epic}</p>
            <p className="text-xs text-white/60">영웅</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-300">{stats.rare}</p>
            <p className="text-xs text-white/60">희귀</p>
          </div>
        </div>
      </div>

      {/* 다음 목표 */}
      {nextBadge && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              다음 목표
            </span>
            <span className="text-xs" style={{ color: 'var(--color-text-sub)' }}>
              {nextBadge.current}/{nextBadge.target}
            </span>
          </div>
          <p className="font-semibold mb-2" style={{ color: 'var(--color-text-title)' }}>
            {nextBadge.title}
          </p>
          <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'var(--color-border)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${nextBadge.progress}%`,
                backgroundColor: 'var(--color-primary)'
              }}
            />
          </div>
          <p className="text-xs mt-1 text-right" style={{ color: 'var(--color-primary)' }}>
            {nextBadge.progress}%
          </p>
        </div>
      )}

      {/* 필터/정렬 */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 p-1 rounded-xl flex-1" style={{ backgroundColor: 'var(--color-bg)' }}>
          {[
            { key: 'all', label: '전체' },
            { key: 'achievement', label: '성과' },
            { key: 'project', label: '프로젝트' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all`}
              style={{
                backgroundColor: activeTab === key ? 'white' : 'transparent',
                color: activeTab === key ? 'var(--color-text-title)' : 'var(--color-text-sub)',
                boxShadow: activeTab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-2 py-2 text-xs rounded-lg"
          style={{
            backgroundColor: 'var(--color-bg)',
            border: 'none',
            color: 'var(--color-text-secondary)'
          }}
        >
          <option value="recent">최신순</option>
          <option value="grade">등급순</option>
        </select>
      </div>

      {/* 배지 그리드 */}
      {sortedBadges.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {sortedBadges.map((badge) => {
            const grade = getBadgeGrade(badge.badge_type, badge.badge_level);
            const gradeStyle = GRADE_STYLES[grade];
            const typeStyle = getBadgeTypeStyle(badge.badge_type, badge.badge_level);

            return (
              <Link
                key={badge.id}
                to={`/badges/${badge.id}`}
                className="card transition-transform active:scale-95"
              >
                {/* 아이콘 */}
                <div className="flex justify-center mb-3">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{
                      background: typeStyle.gradient,
                      boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                      border: '3px solid rgba(255,255,255,0.3)'
                    }}
                  >
                    <span className="text-xl font-bold text-white drop-shadow-md">{typeStyle.icon}</span>
                  </div>
                </div>

                {/* 타이틀 */}
                <h3 className="text-xs font-semibold text-center truncate"
                    style={{ color: 'var(--color-text-title)' }}>
                  {badge.title}
                </h3>

                {/* 등급 뱃지 */}
                <div className="flex justify-center mt-2">
                  <span
                    className="px-2 py-0.5 text-[10px] font-medium rounded-full"
                    style={{ backgroundColor: gradeStyle.bg, color: gradeStyle.text }}
                  >
                    {GRADE_LABELS[grade]}
                  </span>
                </div>

                {/* 획득일 */}
                <p className="text-[10px] text-center mt-1" style={{ color: 'var(--color-text-sub)' }}>
                  {badge.earned_at ? new Date(badge.earned_at).toLocaleDateString('ko-KR') : ''}
                </p>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: 'var(--color-bg)' }}>
            🏅
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text-title)' }}>
            아직 획득한 배지가 없어요
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-sub)' }}>
            근무를 완료하면 배지를 획득할 수 있어요
          </p>
          <Link
            to="/"
            className="inline-flex px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            행사 둘러보기
          </Link>
        </div>
      )}
    </div>
  );
}
