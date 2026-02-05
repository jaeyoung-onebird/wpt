import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * Experience Bar 컴포넌트
 * 현재 경험치와 다음 레벨까지의 진행률을 표시
 *
 * @param {Object} props
 * @param {number} props.currentExp - 현재 경험치
 * @param {number} props.currentLevel - 현재 레벨
 * @param {number} props.nextLevelExp - 다음 레벨 필요 경험치
 * @param {boolean} props.showDetails - 상세 정보 표시 여부
 */
export default function ExperienceBar({
  currentExp = 0,
  currentLevel = 1,
  nextLevelExp = 100,
  showDetails = true
}) {
  // 레벨 정보 (backend worker_levels 테이블과 동기화)
  const levelRequirements = [
    { level: 1, exp: 0, title: '신입' },
    { level: 2, exp: 100, title: '일꾼' },
    { level: 3, exp: 300, title: '숙련공' },
    { level: 4, exp: 700, title: '베테랑' },
    { level: 5, exp: 1500, title: '프로' },
    { level: 6, exp: 3000, title: '마스터' },
    { level: 7, exp: 5000, title: '레전드' },
  ];

  // 현재 레벨의 시작 경험치
  const currentLevelInfo = levelRequirements.find(l => l.level === currentLevel);
  const nextLevelInfo = levelRequirements.find(l => l.level === currentLevel + 1);

  const currentLevelStartExp = currentLevelInfo?.exp || 0;
  const realNextLevelExp = nextLevelInfo?.exp || nextLevelExp;

  // 현재 레벨 내에서의 경험치 (레벨 시작점을 0으로)
  const expInCurrentLevel = currentExp - currentLevelStartExp;
  const expNeededForNextLevel = realNextLevelExp - currentLevelStartExp;

  // 진행률 계산
  const progress = currentLevel >= 7
    ? 100
    : Math.min(100, (expInCurrentLevel / expNeededForNextLevel) * 100);

  // 남은 경험치
  const expRemaining = currentLevel >= 7
    ? 0
    : Math.max(0, realNextLevelExp - currentExp);

  // 레벨별 색상
  const getProgressColor = () => {
    const colors = {
      1: 'from-gray-400 to-gray-600',
      2: 'from-green-400 to-green-600',
      3: 'from-blue-400 to-blue-600',
      4: 'from-purple-400 to-purple-600',
      5: 'from-pink-400 to-pink-600',
      6: 'from-yellow-400 to-orange-500',
      7: 'from-red-500 via-purple-500 to-indigo-500',
    };
    return colors[currentLevel] || colors[1];
  };

  // 애니메이션 효과
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayProgress(progress);
    }, 100);
    return () => clearTimeout(timer);
  }, [progress]);

  if (currentLevel >= 7) {
    return (
      <motion.div
        className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-2xl p-6 text-white shadow-lg"
        animate={{
          boxShadow: [
            '0 0 20px rgba(251, 191, 36, 0.5)',
            '0 0 40px rgba(251, 191, 36, 0.8)',
            '0 0 20px rgba(251, 191, 36, 0.5)',
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="text-center">
          <div className="text-4xl mb-2">💎</div>
          <div className="font-bold text-2xl mb-1">Lv.7 레전드</div>
          <div className="text-sm opacity-90">최고 레벨 달성!</div>
          <div className="mt-4 text-3xl font-bold">{currentExp.toLocaleString()} EXP</div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
      {/* 헤더 */}
      {showDetails && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-lg text-gray-800">경험치</h3>
            <p className="text-sm text-gray-600">
              Lv.{currentLevel} {currentLevelInfo?.title} → Lv.{currentLevel + 1} {nextLevelInfo?.title}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-800">
              {expInCurrentLevel.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">
              / {expNeededForNextLevel.toLocaleString()} EXP
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="relative">
        {/* 배경 */}
        <div className="w-full h-6 bg-gray-200 rounded-full overflow-hidden">
          {/* 진행률 */}
          <motion.div
            className={`h-full bg-gradient-to-r ${getProgressColor()} relative`}
            initial={{ width: 0 }}
            animate={{ width: `${displayProgress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            {/* 반짝임 효과 */}
            <motion.div
              className="absolute inset-0 bg-white opacity-30"
              animate={{
                x: ['-100%', '200%'],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatDelay: 1,
                ease: 'linear',
              }}
              style={{
                width: '30%',
                height: '100%',
                filter: 'blur(10px)',
              }}
            />
          </motion.div>
        </div>

        {/* 퍼센트 표시 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-white drop-shadow-lg">
            {progress.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* 하단 정보 */}
      {showDetails && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <div className="text-gray-600">
            다음 레벨까지
          </div>
          <div className="font-semibold text-gray-800">
            {expRemaining.toLocaleString()} EXP 남음
          </div>
        </div>
      )}

      {/* 경험치 획득 팁 */}
      {showDetails && currentLevel < 3 && (
        <motion.div
          className="mt-4 p-3 bg-blue-50 rounded-xl"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="text-xs text-blue-800">
            <div className="font-semibold mb-1">💡 경험치 획득 방법</div>
            <ul className="space-y-1 text-blue-700">
              <li>• 출근 완료: +5 EXP</li>
              <li>• 근무 완료: 시간당 +2 EXP</li>
              <li>• 높은 평점: +15 EXP</li>
              <li>• 무결근: +20 EXP</li>
            </ul>
          </div>
        </motion.div>
      )}
    </div>
  );
}
