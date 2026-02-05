import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { attendanceAPI } from '../api/client';

export default function MonthlyGoal() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [currentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data } = await attendanceAPI.getMyList();
      const records = data.attendance || [];

      // 이번 달 완료된 근무만 필터링
      const thisMonthRecords = records.filter(r => {
        if (!r.event_date || !r.check_out_time) return false;
        return r.event_date.startsWith(currentMonth);
      });

      // 통계 계산
      const totalDays = thisMonthRecords.length;
      const totalIncome = thisMonthRecords.reduce((sum, r) => {
        const grossPay = r.pay_amount || 0;
        const netPay = Math.round(grossPay * 0.967); // 3.3% 공제
        return sum + netPay;
      }, 0);

      setStats({
        totalDays,
        totalIncome,
        targetDays: 20,
        targetIncome: 2000000,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
      setStats({
        totalDays: 0,
        totalIncome: 0,
        targetDays: 20,
        targetIncome: 2000000,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-6 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const daysProgress = Math.min((stats.totalDays / stats.targetDays) * 100, 100);
  const incomeProgress = Math.min((stats.totalIncome / stats.targetIncome) * 100, 100);
  const [year, month] = currentMonth.split('-');

  return (
    <div className="card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-white/80 text-sm mb-1">{year}년 {parseInt(month)}월 목표</p>
          <h3 className="text-white text-lg font-bold">💪 이번 달 달성률</h3>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl">
          🎯
        </div>
      </div>

      {/* 목표 카드들 */}
      <div className="space-y-3">
        {/* 근무 일수 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-3"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/90 text-sm font-medium">📅 근무 일수</span>
            <span className="text-white text-sm font-bold">
              {stats.totalDays}/{stats.targetDays}일
            </span>
          </div>
          <div className="relative h-2 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${daysProgress}%` }}
              transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
              className="absolute h-full bg-white rounded-full"
            />
          </div>
          <div className="mt-1 text-right">
            <span className="text-white/70 text-xs">{daysProgress.toFixed(0)}% 달성</span>
          </div>
        </motion.div>

        {/* 수입 목표 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-3"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/90 text-sm font-medium">💰 수입 목표</span>
            <span className="text-white text-sm font-bold">
              {stats.totalIncome.toLocaleString()}/{stats.targetIncome.toLocaleString()}원
            </span>
          </div>
          <div className="relative h-2 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${incomeProgress}%` }}
              transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
              className="absolute h-full bg-white rounded-full"
            />
          </div>
          <div className="mt-1 text-right">
            <span className="text-white/70 text-xs">{incomeProgress.toFixed(0)}% 달성</span>
          </div>
        </motion.div>
      </div>

      {/* 격려 메시지 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-4 text-center"
      >
        {incomeProgress >= 100 ? (
          <p className="text-white text-sm">🎉 목표 달성! 축하합니다!</p>
        ) : incomeProgress >= 75 ? (
          <p className="text-white text-sm">🔥 조금만 더 힘내세요!</p>
        ) : incomeProgress >= 50 ? (
          <p className="text-white text-sm">💪 절반 이상 달성했어요!</p>
        ) : (
          <p className="text-white text-sm">🚀 화이팅!</p>
        )}
      </motion.div>
    </div>
  );
}
