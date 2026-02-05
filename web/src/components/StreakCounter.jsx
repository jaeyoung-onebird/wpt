import { motion } from 'framer-motion';

/**
 * Streak Counter 컴포넌트
 * 연속 출석 일수를 표시하고 다음 보너스까지의 진행률을 보여줍니다
 *
 * @param {Object} props
 * @param {number} props.currentStreak - 현재 연속 출석 일수
 * @param {number} props.longestStreak - 최장 연속 출석 일수
 * @param {boolean} props.compact - 컴팩트 모드 (작게 표시)
 */
export default function StreakCounter({ currentStreak = 0, longestStreak = 0, compact = false }) {
  // 다음 보너스 마일스톤 (3일, 7일, 14일, 30일)
  const milestones = [3, 7, 14, 30];
  const nextMilestone = milestones.find(m => m > currentStreak) || milestones[milestones.length - 1];
  const progress = currentStreak >= 30 ? 100 : (currentStreak % nextMilestone / nextMilestone) * 100;

  // Streak에 따른 불 이모지 애니메이션
  const getFlameEmoji = () => {
    if (currentStreak === 0) return '🔥';
    if (currentStreak < 3) return '🔥';
    if (currentStreak < 7) return '🔥🔥';
    if (currentStreak < 14) return '🔥🔥🔥';
    return '🔥🔥🔥🔥';
  };

  // Streak 색상
  const getStreakColor = () => {
    if (currentStreak === 0) return 'text-gray-400';
    if (currentStreak < 3) return 'text-orange-500';
    if (currentStreak < 7) return 'text-orange-600';
    if (currentStreak < 14) return 'text-red-500';
    return 'text-red-600';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <motion.span
          className="text-2xl"
          animate={currentStreak > 0 ? {
            scale: [1, 1.2, 1],
            rotate: [0, 10, -10, 0]
          } : {}}
          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
        >
          {getFlameEmoji()}
        </motion.span>
        <div className="flex flex-col">
          <span className={`font-bold text-lg ${getStreakColor()}`}>
            {currentStreak}일
          </span>
          <span className="text-xs text-gray-500">연속 출석</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-6 border border-orange-200">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <motion.span
            className="text-4xl"
            animate={currentStreak > 0 ? {
              scale: [1, 1.2, 1],
              rotate: [0, 10, -10, 0]
            } : {}}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
          >
            {getFlameEmoji()}
          </motion.span>
          <div>
            <h3 className="font-bold text-lg text-gray-800">연속 출석</h3>
            <p className="text-sm text-gray-600">매일 출근해서 보너스 받기</p>
          </div>
        </div>
      </div>

      {/* 현재 Streak */}
      <div className="text-center mb-4">
        <motion.div
          className={`text-5xl font-bold ${getStreakColor()}`}
          key={currentStreak}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          {currentStreak}
        </motion.div>
        <div className="text-sm text-gray-600 mt-1">
          연속 출석 일수
        </div>
      </div>

      {/* Progress Bar */}
      {currentStreak < 30 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>다음 보너스까지</span>
            <span className="font-semibold">{nextMilestone - (currentStreak % nextMilestone)}일 남음</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{currentStreak % nextMilestone}일</span>
            <span>{nextMilestone}일 (🎁 보너스)</span>
          </div>
        </div>
      )}

      {/* 마일스톤 표시 */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {milestones.map((milestone) => (
          <div
            key={milestone}
            className={`text-center p-2 rounded-lg text-xs ${
              currentStreak >= milestone
                ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white font-semibold'
                : 'bg-white text-gray-400'
            }`}
          >
            <div className="font-bold">{milestone}일</div>
            {currentStreak >= milestone && <div className="text-[10px]">✓ 달성</div>}
          </div>
        ))}
      </div>

      {/* 최장 기록 */}
      {longestStreak > currentStreak && (
        <div className="flex items-center justify-between p-3 bg-white/70 rounded-xl">
          <span className="text-sm text-gray-600">🏆 최장 기록</span>
          <span className="font-bold text-orange-600">{longestStreak}일</span>
        </div>
      )}

      {/* 30일 달성 시 */}
      {currentStreak >= 30 && (
        <motion.div
          className="mt-4 p-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl text-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          <div className="text-white font-bold text-lg mb-1">
            🎉 한 달 연속 출석 달성!
          </div>
          <div className="text-white text-sm opacity-90">
            대단해요! 이 기록을 계속 이어가세요
          </div>
        </motion.div>
      )}
    </div>
  );
}
