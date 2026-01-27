import { useState, useEffect } from 'react';
import { bigdataAPI } from '../api/client';

// 별점 표시 (읽기 전용)
export function StarRating({ rating, size = 'md' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={sizes[size]}
          fill={rating >= star ? '#FBBF24' : 'none'}
          stroke="#FBBF24"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
          />
        </svg>
      ))}
    </div>
  );
}

// 평균 평점 배지
export function RatingBadge({ rating, count }) {
  if (!rating) return null;

  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ backgroundColor: '#FEF3C7' }}>
      <svg className="w-4 h-4" fill="#FBBF24" viewBox="0 0 24 24">
        <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
      <span className="text-sm font-bold" style={{ color: '#D97706' }}>
        {rating.toFixed(1)}
      </span>
      {count && (
        <span className="text-xs" style={{ color: '#92400E' }}>
          ({count})
        </span>
      )}
    </div>
  );
}

// 근무자 평가 통계 카드
export function WorkerRatingStats({ workerId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await bigdataAPI.getWorkerRatingStats(workerId);
        setStats(res.data);
      } catch (err) {
        console.error('Rating stats error:', err);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [workerId]);

  if (loading) {
    return (
      <div className="animate-pulse h-20 rounded-xl bg-gray-100"></div>
    );
  }

  if (!stats || !stats.total_ratings) {
    return (
      <div className="p-4 rounded-xl text-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-sub)' }}>
          아직 받은 평가가 없습니다
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-bg-card)' }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium" style={{ color: 'var(--color-text-title)' }}>평가 현황</h4>
        <RatingBadge rating={stats.avg_rating} count={stats.total_ratings} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-text-title)' }}>
            {stats.total_ratings}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>총 평가</p>
        </div>
        <div>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>
            {stats.good_ratings || 0}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>좋은 평가</p>
        </div>
        <div>
          <p className="text-2xl font-bold" style={{ color: '#EF4444' }}>
            {stats.bad_ratings || 0}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>개선 필요</p>
        </div>
      </div>
    </div>
  );
}

// 출석 평가 목록
export function AttendanceRatings({ attendanceId }) {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRatings = async () => {
      try {
        const res = await bigdataAPI.getAttendanceRatings(attendanceId);
        setRatings(res.data.ratings || []);
      } catch (err) {
        console.error('Ratings error:', err);
      } finally {
        setLoading(false);
      }
    };
    loadRatings();
  }, [attendanceId]);

  if (loading) {
    return <div className="animate-pulse h-10 rounded bg-gray-100"></div>;
  }

  if (ratings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mt-2">
      {ratings.map((r) => (
        <div
          key={r.id}
          className="flex items-center gap-2 p-2 rounded-lg"
          style={{ backgroundColor: 'var(--color-bg)' }}
        >
          <span className="text-xs px-1.5 py-0.5 rounded" style={{
            backgroundColor: r.rater_type === 'MANAGER' ? 'var(--color-navy)' : 'var(--color-primary)',
            color: 'white'
          }}>
            {r.rater_type === 'MANAGER' ? '관리자' : '근무자'}
          </span>
          <StarRating rating={r.rating} size="sm" />
          {r.feedback && (
            <span className="text-xs" style={{ color: 'var(--color-text-sub)' }}>
              "{r.feedback}"
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
