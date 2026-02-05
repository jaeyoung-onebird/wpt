import { motion } from 'framer-motion';

/**
 * Level Badge 컴포넌트
 * 근로자의 레벨과 타이틀을 배지 형태로 표시
 *
 * @param {Object} props
 * @param {number} props.level - 현재 레벨 (1-7)
 * @param {string} props.title - 레벨 타이틀 (예: "신입", "일꾼", "숙련공")
 * @param {boolean} props.compact - 컴팩트 모드
 * @param {boolean} props.showBenefits - 혜택 표시 여부
 * @param {Object} props.benefits - 레벨 혜택 정보
 */
export default function LevelBadge({ level = 1, title = '신입', compact = false, showBenefits = false, benefits = {} }) {
  // 레벨별 색상 테마
  const getLevelTheme = () => {
    const themes = {
      1: { bg: 'from-gray-400 to-gray-600', text: 'text-gray-800', badge: 'bg-gray-500' },
      2: { bg: 'from-green-400 to-green-600', text: 'text-green-800', badge: 'bg-green-500' },
      3: { bg: 'from-blue-400 to-blue-600', text: 'text-blue-800', badge: 'bg-blue-500' },
      4: { bg: 'from-purple-400 to-purple-600', text: 'text-purple-800', badge: 'bg-purple-500' },
      5: { bg: 'from-pink-400 to-pink-600', text: 'text-pink-800', badge: 'bg-pink-500' },
      6: { bg: 'from-yellow-400 to-orange-500', text: 'text-orange-800', badge: 'bg-orange-500' },
      7: { bg: 'from-red-500 via-purple-500 to-indigo-500', text: 'text-red-800', badge: 'bg-gradient-to-r from-red-500 to-purple-500' },
    };
    return themes[level] || themes[1];
  };

  // 레벨별 아이콘
  const getLevelIcon = () => {
    const icons = {
      1: '🌱',  // 신입
      2: '⚡',  // 일꾼
      3: '💪',  // 숙련공
      4: '🔥',  // 베테랑
      5: '⭐',  // 프로
      6: '👑',  // 마스터
      7: '💎',  // 레전드
    };
    return icons[level] || icons[1];
  };

  const theme = getLevelTheme();

  if (compact) {
    return (
      <motion.div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${theme.bg} text-white shadow-lg`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <span className="text-lg">{getLevelIcon()}</span>
        <span className="font-bold text-sm">Lv.{level}</span>
        <span className="text-xs opacity-90">{title}</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="relative bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-100 overflow-hidden"
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200 }}
    >
      {/* 배경 그라디언트 */}
      <div className={`absolute inset-0 bg-gradient-to-br ${theme.bg} opacity-10`} />

      {/* 컨텐츠 */}
      <div className="relative z-10">
        {/* 레벨 배지 */}
        <div className="flex items-center justify-center mb-4">
          <motion.div
            className={`w-24 h-24 rounded-full bg-gradient-to-br ${theme.bg} flex items-center justify-center shadow-xl`}
            whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center">
              <div className="text-4xl mb-1">{getLevelIcon()}</div>
              <div className="text-white font-bold text-lg">Lv.{level}</div>
            </div>
          </motion.div>
        </div>

        {/* 타이틀 */}
        <div className="text-center mb-4">
          <h3 className={`text-2xl font-bold ${theme.text} mb-1`}>{title}</h3>
          <p className="text-sm text-gray-600">당신은 {title} 근로자입니다</p>
        </div>

        {/* 혜택 표시 */}
        {showBenefits && Object.keys(benefits).length > 0 && (
          <motion.div
            className="mt-4 p-4 bg-gray-50 rounded-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h4 className="font-semibold text-sm text-gray-700 mb-2">🎁 레벨 혜택</h4>
            <div className="space-y-2">
              {benefits.wpt_boost && benefits.wpt_boost > 1 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">WPT 보상</span>
                  <span className="font-semibold text-green-600">
                    +{((benefits.wpt_boost - 1) * 100).toFixed(0)}% 증가
                  </span>
                </div>
              )}
              {benefits.priority && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-yellow-500">⚡</span>
                  <span className="text-gray-600">우선 매칭 권한</span>
                </div>
              )}
              {benefits.featured && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-purple-500">✨</span>
                  <span className="text-gray-600">프로필 강조 표시</span>
                </div>
              )}
              {benefits.exclusive && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-red-500">👑</span>
                  <span className="text-gray-600">독점 행사 접근</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* 다음 레벨 안내 */}
        {level < 7 && (
          <div className="mt-4 text-center text-xs text-gray-500">
            다음 레벨까지 더 많은 경험치를 쌓아보세요!
          </div>
        )}

        {/* 최고 레벨 달성 */}
        {level === 7 && (
          <motion.div
            className="mt-4 p-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl text-center"
            animate={{
              boxShadow: [
                '0 0 20px rgba(251, 191, 36, 0.5)',
                '0 0 40px rgba(251, 191, 36, 0.8)',
                '0 0 20px rgba(251, 191, 36, 0.5)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="text-white font-bold text-sm">
              🎉 최고 레벨 달성!
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
