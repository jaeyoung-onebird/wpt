import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

/**
 * Match Score Card Component
 * Displays an individual event recommendation with AI matching score breakdown
 */
export default function MatchScoreCard({ recommendation, rank, compact = false }) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const {
    event_id,
    event_title,
    event_date,
    location,
    pay_amount,
    score: matchScore,
    score_breakdown,
    available
  } = recommendation;

  // Score color coding
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-blue-600 bg-blue-100';
    if (score >= 40) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getScoreBadgeColor = (score) => {
    if (score >= 80) return 'from-green-400 to-green-600';
    if (score >= 60) return 'from-blue-400 to-blue-600';
    if (score >= 40) return 'from-yellow-400 to-yellow-600';
    return 'from-red-400 to-red-600';
  };

  // Score icon
  const getScoreEmoji = (score) => {
    if (score >= 90) return '🌟';
    if (score >= 80) return '⭐';
    if (score >= 70) return '✨';
    if (score >= 60) return '👍';
    return '👌';
  };

  // Rank badges
  const getRankBadge = () => {
    if (rank === 1) return { emoji: '🥇', color: 'from-yellow-400 to-yellow-600', text: '최고 추천' };
    if (rank === 2) return { emoji: '🥈', color: 'from-gray-400 to-gray-600', text: '2순위' };
    if (rank === 3) return { emoji: '🥉', color: 'from-orange-400 to-orange-600', text: '3순위' };
    return null;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parseInt(parts[1])}월 ${parseInt(parts[2])}일`;
    }
    return dateStr;
  };

  // Format pay
  const formatPay = (amount) => {
    if (!amount) return '-';
    return `${Number(amount).toLocaleString()}원`;
  };

  const rankBadge = getRankBadge();

  return (
    <motion.div
      className={`bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border-2 ${
        !available ? 'border-gray-300 opacity-70' : 'border-gray-100 hover:border-primary'
      }`}
      whileHover={{ scale: compact ? 1 : 1.02 }}
    >
      {/* Main Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          {/* Title and Info */}
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-1">
              {rankBadge && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r ${rankBadge.color} text-white text-xs font-bold`}
                >
                  {rankBadge.emoji} {rankBadge.text}
                </span>
              )}
              {!available && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-semibold">
                  ⚠️ 일정 충돌
                </span>
              )}
            </div>

            <Link to={`/events/${event_id}`}>
              <h4 className="font-bold text-gray-800 hover:text-primary transition-colors text-base mb-1 truncate">
                {event_title}
              </h4>
            </Link>

            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <span>📅</span>
                <span>{formatDate(event_date)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span>📍</span>
                <span className="truncate max-w-[150px]">{location || '위치 미정'}</span>
              </div>
              <div className="flex items-center gap-1 font-semibold text-primary">
                <span>💰</span>
                <span>{formatPay(pay_amount)}</span>
              </div>
            </div>
          </div>

          {/* Match Score Badge */}
          <div className="flex-shrink-0">
            <motion.div
              className={`relative w-16 h-16 rounded-xl bg-gradient-to-br ${getScoreBadgeColor(
                matchScore
              )} flex flex-col items-center justify-center text-white shadow-lg`}
              whileHover={{ rotate: [0, -5, 5, 0], scale: 1.1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="text-xs font-medium opacity-90">매칭</div>
              <div className="text-xl font-bold">{Math.round(matchScore)}</div>
              <div className="text-xs opacity-75">점</div>
            </motion.div>
          </div>
        </div>

        {/* Score Breakdown Toggle */}
        {score_breakdown && !compact && (
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full mt-3 py-2 px-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium text-gray-700 flex items-center justify-between"
          >
            <span>상세 점수 보기</span>
            <motion.span
              animate={{ rotate: showBreakdown ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              ▼
            </motion.span>
          </button>
        )}

        {/* Detailed Score Breakdown */}
        {showBreakdown && score_breakdown && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 space-y-2"
          >
            {/* Distance Score */}
            <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-lg">📍</span>
                <div>
                  <div className="text-xs font-semibold text-gray-700">거리</div>
                  <div className="text-xs text-gray-600">{score_breakdown.distance.toFixed(0)}점</div>
                </div>
              </div>
              <div className="text-xs text-gray-500">가까울수록 높음</div>
            </div>

            {/* Reliability Score */}
            <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-lg">⭐</span>
                <div>
                  <div className="text-xs font-semibold text-gray-700">신뢰도</div>
                  <div className="text-xs text-gray-600">{score_breakdown.reliability.toFixed(0)}점</div>
                </div>
              </div>
              <div className="text-xs text-gray-500">완료율 & 평점</div>
            </div>

            {/* Pay Score */}
            <div className="flex items-center justify-between p-2 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-lg">💰</span>
                <div>
                  <div className="text-xs font-semibold text-gray-700">급여</div>
                  <div className="text-xs text-gray-600">{score_breakdown.pay.toFixed(0)}점</div>
                </div>
              </div>
              <div className="text-xs text-gray-500">평소 대비 높음</div>
            </div>

            {/* Skill Score */}
            <div className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎯</span>
                <div>
                  <div className="text-xs font-semibold text-gray-700">스킬</div>
                  <div className="text-xs text-gray-600">{score_breakdown.skill.toFixed(0)}점</div>
                </div>
              </div>
              <div className="text-xs text-gray-500">자격증 & 경력</div>
            </div>

            {/* Availability Score */}
            <div className="flex items-center justify-between p-2 bg-pink-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-lg">📅</span>
                <div>
                  <div className="text-xs font-semibold text-gray-700">가용성</div>
                  <div className="text-xs text-gray-600">{score_breakdown.availability.toFixed(0)}점</div>
                </div>
              </div>
              <div className="text-xs text-gray-500">일정 겹침 없음</div>
            </div>

            {/* Total Score Summary */}
            <div className="mt-3 p-3 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{getScoreEmoji(matchScore)}</span>
                  <div>
                    <div className="text-xs font-medium text-gray-600">종합 매칭 점수</div>
                    <div className="text-sm font-bold text-gray-800">
                      {matchScore.toFixed(1)}점 / 100점
                    </div>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${getScoreColor(matchScore)}`}>
                  {matchScore >= 80
                    ? '최적'
                    : matchScore >= 60
                    ? '적합'
                    : matchScore >= 40
                    ? '보통'
                    : '고려'}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Action Button */}
        <Link to={`/events/${event_id}`}>
          <motion.button
            className={`w-full mt-3 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
              available
                ? 'bg-primary text-white hover:bg-primary-dark'
                : 'bg-gray-300 text-gray-600 cursor-not-allowed'
            }`}
            whileHover={available ? { scale: 1.02 } : {}}
            whileTap={available ? { scale: 0.98 } : {}}
            disabled={!available}
          >
            {available ? '상세 보기 & 지원하기' : '일정 충돌로 지원 불가'}
          </motion.button>
        </Link>
      </div>
    </motion.div>
  );
}
