import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { creditsAPI, adminAPI, attendanceAPI } from '../../api/client';
import { formatPay } from '../../utils/format';

export default function AdminFinance() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [wptHistory, setWptHistory] = useState([]);
  const [payrollStats, setPayrollStats] = useState(null);
  const [period, setPeriod] = useState('month'); // month, quarter, year
  const [historyFilter, setHistoryFilter] = useState('all'); // all, mint, burn

  useEffect(() => {
    window.scrollTo(0, 0);
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [wptStatsRes, wptHistoryRes, analyticsRes] = await Promise.all([
        creditsAPI.getAdminStats().catch(() => ({ data: null })),
        creditsAPI.getAdminHistory(100, 0, null).catch(() => ({ data: { transactions: [] } })),
        adminAPI.getAnalytics(period === 'month' ? 30 : period === 'quarter' ? 90 : 365).catch(() => ({ data: null })),
      ]);

      setStats(wptStatsRes.data);
      setWptHistory(wptHistoryRes.data.transactions || []);

      // 급여 통계 계산
      if (analyticsRes.data) {
        const analytics = analyticsRes.data;
        setPayrollStats({
          totalPayroll: analytics.total_payroll || 0,
          completedEvents: analytics.completed_events || 0,
          activeWorkers: analytics.active_workers || 0,
          avgPayPerEvent: analytics.avg_pay_per_event || 0,
        });
      }
    } catch (error) {
      console.error('Failed to load finance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return '-';
    const date = new Date(dateTimeStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${month}월 ${day}일 ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const getWptIcon = (txType) => {
    const icons = {
      MINT: '💰',
      BURN: '🔥',
      REWARD: '🎁',
      BONUS: '✨',
      PENALTY: '⚠️',
      ADMIN: '👨‍💼',
    };
    return icons[txType] || '💸';
  };

  const getWptColor = (txType, amount) => {
    if (amount > 0) {
      return { bg: '#D1FAE5', text: '#059669' };
    } else {
      return { bg: '#FEE2E2', text: '#DC2626' };
    }
  };

  const filteredHistory = wptHistory.filter(tx => {
    if (historyFilter === 'all') return true;
    if (historyFilter === 'mint') return tx.amount > 0;
    if (historyFilter === 'burn') return tx.amount < 0;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* 헤더 */}
      <div className="pt-2">
        <h1 className="text-2xl font-bold text-gray-900">재무 현황</h1>
        <p className="text-sm text-gray-500 mt-1">급여 지출 및 WPT 통계</p>
      </div>

      {/* 기간 선택 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: 'month', label: '최근 1개월' },
          { key: 'quarter', label: '최근 3개월' },
          { key: 'year', label: '최근 1년' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
            style={{
              backgroundColor: period === key ? 'var(--color-primary)' : 'var(--color-bg)',
              color: period === key ? 'white' : 'var(--color-text-secondary)'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 총 급여 지출 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
        >
          <div className="text-white/80 text-xs mb-1">총 급여 지출</div>
          <div className="text-white text-lg font-bold mb-2">
            {payrollStats ? formatPay(payrollStats.totalPayroll) : '0원'}
          </div>
          <div className="text-white/70 text-xs">
            {payrollStats?.completedEvents || 0}건 완료
          </div>
        </motion.div>

        {/* 평균 급여 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
          style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}
        >
          <div className="text-white/80 text-xs mb-1">행사당 평균</div>
          <div className="text-white text-lg font-bold mb-2">
            {payrollStats ? formatPay(payrollStats.avgPayPerEvent) : '0원'}
          </div>
          <div className="text-white/70 text-xs">
            {payrollStats?.activeWorkers || 0}명 참여
          </div>
        </motion.div>

        {/* WPT 총 발행량 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
          style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}
        >
          <div className="text-white/80 text-xs mb-1">WPT 총 발행</div>
          <div className="text-white text-lg font-bold mb-2">
            {stats?.total_minted?.toLocaleString() || 0}
          </div>
          <div className="text-white/70 text-xs">
            누적 발행량
          </div>
        </motion.div>

        {/* WPT 총 소각량 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
          style={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' }}
        >
          <div className="text-white/80 text-xs mb-1">WPT 총 소각</div>
          <div className="text-white text-lg font-bold mb-2">
            {stats?.total_burned?.toLocaleString() || 0}
          </div>
          <div className="text-white/70 text-xs">
            누적 소각량
          </div>
        </motion.div>
      </div>

      {/* WPT 유통량 */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-white/80 text-sm mb-1">현재 WPT 유통량</div>
            <div className="text-white text-2xl font-bold">
              {stats?.total_supply?.toLocaleString() || 0}
            </div>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center text-3xl">
            💎
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 text-center">
            <div className="text-white/60 text-xs mb-0.5">활성 사용자</div>
            <div className="text-white text-sm font-semibold">
              {stats?.active_users?.toLocaleString() || 0}명
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 text-center">
            <div className="text-white/60 text-xs mb-0.5">평균 보유량</div>
            <div className="text-white text-sm font-semibold">
              {stats?.avg_balance?.toLocaleString() || 0}
            </div>
          </div>
        </div>
      </div>

      {/* WPT 거래 내역 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">WPT 거래 내역</h2>
        </div>

        {/* 필터 */}
        <div className="flex gap-2 mb-3">
          {[
            { key: 'all', label: '전체', icon: '📋' },
            { key: 'mint', label: '발행', icon: '💰' },
            { key: 'burn', label: '소각', icon: '🔥' },
          ].map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setHistoryFilter(key)}
              className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1"
              style={{
                backgroundColor: historyFilter === key ? 'var(--color-primary)' : 'var(--color-bg)',
                color: historyFilter === key ? 'white' : 'var(--color-text-secondary)'
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* 거래 목록 */}
        <div className="space-y-2">
          {filteredHistory.length > 0 ? (
            filteredHistory.slice(0, 20).map((tx) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="card"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{
                        backgroundColor: getWptColor(tx.tx_type, tx.amount).bg,
                      }}
                    >
                      {getWptIcon(tx.tx_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-gray-900">
                        {tx.description || 'WPT 거래'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {tx.worker_name || '알 수 없음'} · {formatDateTime(tx.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <p
                      className="text-base font-bold"
                      style={{
                        color: getWptColor(tx.tx_type, tx.amount).text,
                      }}
                    >
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      잔액 {tx.balance_after?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="card text-center py-8">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center text-xl bg-gray-100">
                📊
              </div>
              <p className="text-sm text-gray-500 mb-2">거래 내역이 없습니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
