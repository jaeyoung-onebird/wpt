import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { nftAPI } from '../api/client';

// 등급별 스타일
const GRADE_STYLES = {
  COMMON: {
    bg: 'linear-gradient(135deg, #4A5568, #2D3748)',
    badge: '#718096',
    label: '일반'
  },
  RARE: {
    bg: 'linear-gradient(135deg, #2B6CB0, #1A365D)',
    badge: '#3182CE',
    label: '희귀'
  },
  EPIC: {
    bg: 'linear-gradient(135deg, #6B46C1, #44337A)',
    badge: '#805AD5',
    label: '영웅'
  },
  LEGENDARY: {
    bg: 'linear-gradient(135deg, #B7791F, #744210)',
    badge: '#D69E2E',
    label: '전설'
  },
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

const BADGE_TYPE_LABELS = {
  WORK_COUNT: '근무 횟수',
  TRUST: '신뢰도',
  BLOCKCHAIN: '블록체인',
  PROFILE: '프로필',
  PHOTO: '사진',
  PROJECT: '프로젝트',
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

export default function BadgeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [badge, setBadge] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadBadge();
  }, [id]);

  const loadBadge = async () => {
    try {
      const { data } = await nftAPI.getMyBadgeDetail(id);
      setBadge(data);
    } catch (error) {
      console.error('Failed to load badge:', error);
      if (error.response?.status === 404 || error.response?.status === 403) {
        navigate('/badges');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!badge) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>배지를 찾을 수 없습니다</p>
      </div>
    );
  }

  const grade = getBadgeGrade(badge.badge_type, badge.badge_level);
  const gradeStyle = GRADE_STYLES[grade];
  const typeStyle = getBadgeTypeStyle(badge.badge_type, badge.badge_level);

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
        <h1 className="text-lg font-bold" style={{ color: 'var(--color-text-title)' }}>배지 상세</h1>
      </div>

      {/* 배지 카드 */}
      <div className="mx-4 mt-6">
        <div
          className="rounded-2xl p-6 text-center text-white shadow-lg"
          style={{ background: gradeStyle.bg }}
        >
          {/* 아이콘 - 컬러풀한 그라데이션 원형 스타일 */}
          <div className="flex justify-center mb-4">
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center"
              style={{
                background: typeStyle.gradient,
                border: '4px solid rgba(255,255,255,0.4)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 0 20px rgba(255,255,255,0.2)'
              }}
            >
              <span className="text-5xl font-bold text-white drop-shadow-lg">{typeStyle.icon}</span>
            </div>
          </div>

          {/* 타이틀 */}
          <h2 className="text-2xl font-bold mb-2">{badge.title}</h2>

          {/* 설명 */}
          {badge.description && (
            <p className="text-white/80 text-sm mb-4">{badge.description}</p>
          )}

          {/* 등급 뱃지 */}
          <span
            className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold"
            style={{ backgroundColor: gradeStyle.badge }}
          >
            {gradeStyle.label}
          </span>
        </div>
      </div>

      {/* 상세 정보 */}
      <div className="mx-4 mt-6 p-4 rounded-xl" style={{ backgroundColor: 'var(--color-card)' }}>
        <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text-title)' }}>
          배지 정보
        </h3>

        <div className="space-y-3">
          <div className="flex justify-between">
            <span style={{ color: 'var(--color-text-sub)' }}>유형</span>
            <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              {BADGE_TYPE_LABELS[badge.badge_type] || badge.badge_type}
            </span>
          </div>

          <div className="flex justify-between">
            <span style={{ color: 'var(--color-text-sub)' }}>획득일</span>
            <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              {badge.earned_at ? new Date(badge.earned_at).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }) : '-'}
            </span>
          </div>

          {badge.event_name && (
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-text-sub)' }}>이벤트</span>
              <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                {badge.event_name}
              </span>
            </div>
          )}

          <div className="flex justify-between">
            <span style={{ color: 'var(--color-text-sub)' }}>상태</span>
            <span className={`font-medium ${badge.status === 'ACTIVE' ? 'text-green-500' : 'text-red-500'}`}>
              {badge.status === 'ACTIVE' ? '활성' : '취소됨'}
            </span>
          </div>

          <div className="flex justify-between">
            <span style={{ color: 'var(--color-text-sub)' }}>NFT ID</span>
            <span className="font-mono text-sm" style={{ color: 'var(--color-text-sub)' }}>
              #{badge.id}
            </span>
          </div>
        </div>
      </div>

      {/* NFT 이미지 미리보기 */}
      <div className="mx-4 mt-6 p-4 rounded-xl" style={{ backgroundColor: 'var(--color-card)' }}>
        <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text-title)' }}>
          NFT 이미지
        </h3>
        <div className="flex justify-center">
          <img
            src={badge.image_url}
            alt={badge.title}
            className="max-w-full h-auto rounded-lg shadow-md"
            style={{ maxHeight: '300px' }}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
        <p className="text-xs text-center mt-3" style={{ color: 'var(--color-text-sub)' }}>
          이 배지는 블록체인에 기록된 Soulbound NFT입니다
        </p>
      </div>

      {/* 공유 버튼 (미래 기능) */}
      <div className="mx-4 mt-6">
        <button
          className="w-full py-3 rounded-xl font-medium text-white"
          style={{ backgroundColor: 'var(--color-primary)' }}
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: badge.title,
                text: `${badge.title} 배지를 획득했습니다!`,
                url: window.location.href
              });
            } else {
              navigator.clipboard.writeText(window.location.href);
              alert('링크가 복사되었습니다');
            }
          }}
        >
          배지 공유하기
        </button>
      </div>
    </div>
  );
}
