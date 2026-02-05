import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * WPT 보상 애니메이션 컴포넌트
 *
 * @param {Object} props
 * @param {Object} props.reward - 보상 정보 { amount, streak, exp, leveled_up }
 * @param {Function} props.onComplete - 애니메이션 완료 콜백
 */
export default function WPTRewardAnimation({ reward, onComplete }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (reward) {
      setShow(true);

      // 3초 후 자동 닫기
      const timer = setTimeout(() => {
        setShow(false);
        if (onComplete) {
          setTimeout(onComplete, 300); // 페이드 아웃 후 콜백
        }
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [reward, onComplete]);

  if (!reward) return null;

  const { wpt_reward, streak, exp, leveled_up } = reward;
  const totalWPT = wpt_reward?.amount || 0;
  const streakCount = streak?.current || 0;
  const streakBonus = streak?.bonus_wpt || 0;
  const expGained = exp?.exp_gained || 0;
  const newLevel = exp?.level || 1;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShow(false)}
        >
          <motion.div
            className="relative bg-gradient-to-br from-yellow-400 via-orange-400 to-red-500 rounded-3xl shadow-2xl p-8 max-w-sm mx-4"
            initial={{ scale: 0.5, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0.5, rotate: 10 }}
            transition={{ type: 'spring', duration: 0.5 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 코인 아이콘 */}
            <motion.div
              className="absolute -top-12 left-1/2 -translate-x-1/2"
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <div className="w-24 h-24 bg-yellow-300 rounded-full flex items-center justify-center shadow-xl border-4 border-yellow-500">
                <span className="text-4xl">💰</span>
              </div>
            </motion.div>

            {/* 메인 WPT 보상 */}
            <div className="mt-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 300 }}
              >
                <div className="text-white text-6xl font-bold mb-2">
                  +{totalWPT}
                </div>
                <div className="text-yellow-100 text-2xl font-semibold mb-4">
                  WPT
                </div>
              </motion.div>

              {/* Streak 정보 */}
              {streakCount > 0 && (
                <motion.div
                  className="bg-white/20 backdrop-blur-sm rounded-xl p-3 mb-3"
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl">🔥</span>
                    <span className="text-white font-semibold">
                      {streakCount}일 연속 출석!
                    </span>
                  </div>
                  {streakBonus > 0 && (
                    <div className="text-yellow-200 text-sm mt-1">
                      보너스 +{streakBonus} WPT
                    </div>
                  )}
                </motion.div>
              )}

              {/* 경험치 정보 */}
              {expGained > 0 && (
                <motion.div
                  className="bg-white/20 backdrop-blur-sm rounded-xl p-3 mb-3"
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <div className="text-white font-semibold">
                    ⭐ +{expGained} EXP
                  </div>
                </motion.div>
              )}

              {/* 레벨업 */}
              {leveled_up && (
                <motion.div
                  className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-4 mt-3"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.7, type: 'spring', stiffness: 200 }}
                >
                  <div className="text-white text-xl font-bold mb-1">
                    🎉 레벨업!
                  </div>
                  <div className="text-white text-lg">
                    Lv.{newLevel}
                  </div>
                </motion.div>
              )}

              {/* 닫기 안내 */}
              <motion.div
                className="mt-4 text-yellow-100 text-sm opacity-70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                transition={{ delay: 1 }}
              >
                3초 후 자동으로 닫힙니다
              </motion.div>
            </div>

            {/* 코인 파티클 효과 */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-8 h-8 text-2xl"
                initial={{
                  x: 0,
                  y: 0,
                  opacity: 1,
                  scale: 0
                }}
                animate={{
                  x: Math.cos((i * Math.PI * 2) / 8) * 150,
                  y: Math.sin((i * Math.PI * 2) / 8) * 150,
                  opacity: 0,
                  scale: 1
                }}
                transition={{
                  duration: 1.5,
                  delay: 0.3,
                  ease: 'easeOut'
                }}
                style={{
                  left: '50%',
                  top: '50%',
                }}
              >
                💰
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
