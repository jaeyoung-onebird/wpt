import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { nftAPI } from '../api/client';

// 등급별 스타일
const GRADE_STYLES = {
  COMMON: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' },
  RARE: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-300' },
  EPIC: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-300' },
  LEGENDARY: { bg: 'bg-yellow-100', text: 'text-yellow-600', border: 'border-yellow-300' },
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
  // WORK_COUNT, TRUST, BLOCKCHAIN은 레벨별로 다른 색상
  if (typeof typeColors === 'object' && typeColors[badgeLevel]) {
    return typeColors[badgeLevel];
  }
  return typeColors;
}

export default function Badges() {
  const { worker } = useAuth();
  const navigate = useNavigate();
  const [badges, setBadges] = useState([]);
  const [topBadges, setTopBadges] = useState([]);
  const [nextBadge, setNextBadge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, achievement, project
  const [sortBy, setSortBy] = useState('recent'); // recent, grade

  useEffect(() => {
    window.scrollTo(0, 0);
    loadBadges();
  }, []);

  const loadBadges = async () => {
    try {
      const { data } = await nftAPI.getMyBadges();
      setBadges(data.badges || []);
      setTopBadges(data.top_badges || []);
      setNextBadge(data.next_badge);
    } catch (error) {
      console.error('Failed to load badges:', error);
    } finally {
      setLoading(false);
    }
  };

  // 필터링
  const filteredBadges = badges.filter(badge => {
    if (filter === 'achievement') return badge.badge_type !== 'PROJECT';
    if (filter === 'project') return badge.badge_type === 'PROJECT';
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* 헤더 */}
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3"
           style={{ backgroundColor: 'var(--color-card)', borderBottom: '1px solid var(--color-border)' }}>
        <button onClick={() => navigate(-1)} className="p-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold" style={{ color: 'var(--color-text-title)' }}>내 배지</h1>
        <span className="ml-auto text-sm" style={{ color: 'var(--color-text-sub)' }}>
          총 {badges.length}개
        </span>
      </div>

      {/* 다음 목표 진행률 */}
      {nextBadge && (
        <div className="mx-4 mt-4 p-4 rounded-xl" style={{ backgroundColor: 'var(--color-card)' }}>
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
      <div className="px-4 mt-4 flex items-center gap-2">
        <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--color-card)' }}>
          {[
            { key: 'all', label: '전체' },
            { key: 'achievement', label: '성과' },
            { key: 'project', label: '프로젝트' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === key ? 'text-white' : ''
              }`}
              style={{
                backgroundColor: filter === key ? 'var(--color-primary)' : 'transparent',
                color: filter === key ? '#fff' : 'var(--color-text-secondary)'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="ml-auto px-2 py-1.5 text-xs rounded-md border"
          style={{
            backgroundColor: 'var(--color-card)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)'
          }}
        >
          <option value="recent">최신순</option>
          <option value="grade">등급순</option>
        </select>
      </div>

      {/* 배지 그리드 */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-3">
        {sortedBadges.map((badge) => {
          const grade = getBadgeGrade(badge.badge_type, badge.badge_level);
          const gradeStyle = GRADE_STYLES[grade];
          const typeStyle = getBadgeTypeStyle(badge.badge_type, badge.badge_level);

          return (
            <Link
              key={badge.id}
              to={`/badges/${badge.id}`}
              className="block p-4 rounded-xl border transition-transform active:scale-95"
              style={{
                backgroundColor: 'var(--color-card)',
                borderColor: 'var(--color-border)'
              }}
            >
              {/* 아이콘 - 컬러풀한 그라데이션 원형 스타일 */}
              <div className="flex justify-center mb-3">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{
                    background: typeStyle.gradient,
                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                    border: '3px solid rgba(255,255,255,0.3)'
                  }}
                >
                  <span className="text-2xl font-bold text-white drop-shadow-md">{typeStyle.icon}</span>
                </div>
              </div>

              {/* 타이틀 */}
              <h3 className="text-sm font-semibold text-center truncate"
                  style={{ color: 'var(--color-text-title)' }}>
                {badge.title}
              </h3>

              {/* 등급 뱃지 */}
              <div className="flex justify-center mt-2">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${gradeStyle.bg} ${gradeStyle.text}`}>
                  {GRADE_LABELS[grade]}
                </span>
              </div>

              {/* 획득일 */}
              <p className="text-xs text-center mt-2" style={{ color: 'var(--color-text-sub)' }}>
                {badge.earned_at ? new Date(badge.earned_at).toLocaleDateString('ko-KR') : ''}
              </p>
            </Link>
          );
        })}
      </div>

      {/* 빈 상태 */}
      {sortedBadges.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🏅</div>
          <p className="text-lg font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            아직 획득한 배지가 없습니다
          </p>
          <p className="text-sm mt-2" style={{ color: 'var(--color-text-sub)' }}>
            근무를 완료하면 배지를 획득할 수 있어요
          </p>
        </div>
      )}
    </div>
  );
}
