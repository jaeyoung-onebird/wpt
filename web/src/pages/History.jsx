import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { gamificationAPI, badgesAPI, attendanceAPI, nftAPI } from '../api/client';
import { formatPay, formatDateShort, calculateNetPay } from '../utils/format';

export default function History() {
  const { user, worker } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, wpt, badge, work
  const [timeline, setTimeline] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (worker) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [worker]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [wptRes, badgesRes, workRes, statsRes] = await Promise.all([
        gamificationAPI.getMyTransactions(100).catch(() => ({ data: { transactions: [] } })),
        badgesAPI.getMyBadges().catch(() => ({ data: { badges: [] } })),
        attendanceAPI.getMyList().catch(() => ({ data: { attendance: [] } })),
        gamificationAPI.getMyStats().catch(() => ({ data: null })),
      ]);

      // WPT 거래
      const wptItems = (wptRes.data.transactions || []).map(tx => ({
        id: `wpt-${tx.id}`,
        type: 'wpt',
        date: tx.created_at,
        amount: tx.amount,
        balance: tx.balance_after,
        txType: tx.tx_type,
        description: tx.description,
        raw: tx,
      }));

      // NFT 배지
      const badgeItems = (badgesRes.data.badges || []).map(badge => ({
        id: `badge-${badge.id}`,
        type: 'badge',
        date: badge.awarded_at,
        badgeType: badge.badge_type,
        badgeLevel: badge.badge_level,
        badgeName: badge.badge_name,
        description: badge.description,
        imageUrl: nftAPI.getBadgeImageUrl(badge.id),
        raw: badge,
      }));

      // 근무 이력 (완료된 것만)
      const workItems = (workRes.data.attendance || [])
        .filter(att => att.check_out_time)
        .map(att => ({
          id: `work-${att.id}`,
          type: 'work',
          date: att.check_out_time || att.event_date,
          eventTitle: att.event_title,
          eventDate: att.event_date,
          checkIn: att.check_in_time,
          checkOut: att.check_out_time,
          payAmount: att.pay_amount,
          workedMinutes: att.worked_minutes,
          txHash: att.tx_hash,
          raw: att,
        }));

      // 모든 항목 합치고 날짜순 정렬
      const allItems = [...wptItems, ...badgeItems, ...workItems];
      allItems.sort((a, b) => new Date(b.date) - new Date(a.date));

      setTimeline(allItems);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTimeline = timeline.filter(item => {
    if (filter === 'all') return true;
    return item.type === filter;
  });

  // 날짜 포맷
  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return '-';
    const date = new Date(dateTimeStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${month}월 ${day}일 ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // WPT 거래 타입 아이콘
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

  // WPT 거래 타입 색상
  const getWptColor = (txType, amount) => {
    if (amount > 0) {
      return { bg: '#D1FAE5', text: '#059669' };
    } else {
      return { bg: '#FEE2E2', text: '#DC2626' };
    }
  };

  // 배지 등급 색상
  const getBadgeColor = (level) => {
    const colors = {
      BRONZE: { bg: '#FEE2E2', text: '#DC2626', gradient: 'linear-gradient(135deg, #CD7F32 0%, #8B4513 100%)' },
      SILVER: { bg: '#F3F4F6', text: '#6B7280', gradient: 'linear-gradient(135deg, #C0C0C0 0%, #808080 100%)' },
      GOLD: { bg: '#FEF3C7', text: '#D97706', gradient: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' },
      PLATINUM: { bg: '#E0E7FF', text: '#4F46E5', gradient: 'linear-gradient(135deg, #E5E4E2 0%, #BCC6CC 100%)' },
      DIAMOND: { bg: '#DBEAFE', text: '#1E40AF', gradient: 'linear-gradient(135deg, #B9F2FF 0%, #00B4D8 100%)' },
    };
    return colors[level] || colors.BRONZE;
  };

  if (!user) {
    return (
      <div className="p-4 animate-fade-in">
        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: 'var(--color-bg)' }}>
            🔒
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text-title)' }}>로그인이 필요합니다</p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-sub)' }}>히스토리를 확인하려면 로그인해주세요</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            로그인하기
          </button>
        </div>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="p-4 animate-fade-in">
        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: 'var(--color-bg)' }}>
            👤
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text-title)' }}>회원등록이 필요합니다</p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-sub)' }}>프로필 등록 후 히스토리를 확인할 수 있어요</p>
          <button
            onClick={() => navigate('/register')}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            회원등록
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* 헤더 */}
      <div className="pt-2">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-title)' }}>내 히스토리</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-sub)' }}>WPT, 배지, 근무 이력을 한눈에</p>
      </div>

      {/* 통계 요약 */}
      {stats && (
        <div className="card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/80 text-sm mb-1">나의 성과</p>
              <h3 className="text-white text-lg font-bold">레벨 {stats.current_level}</h3>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl">
              🏆
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2.5 text-center">
              <p className="text-white/80 text-xs mb-1">WPT</p>
              <p className="text-white text-sm font-bold">{stats.wpt_balance?.toLocaleString() || 0}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2.5 text-center">
              <p className="text-white/80 text-xs mb-1">배지</p>
              <p className="text-white text-sm font-bold">{stats.total_badges || 0}개</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2.5 text-center">
              <p className="text-white/80 text-xs mb-1">근무</p>
              <p className="text-white text-sm font-bold">{stats.completed_events || 0}회</p>
            </div>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: 'all', label: '전체', icon: '📋' },
          { key: 'wpt', label: 'WPT', icon: '💰' },
          { key: 'badge', label: '배지', icon: '🏅' },
          { key: 'work', label: '근무', icon: '💼' },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1"
            style={{
              backgroundColor: filter === key ? 'var(--color-primary)' : 'var(--color-bg)',
              color: filter === key ? 'white' : 'var(--color-text-secondary)'
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* 타임라인 */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredTimeline.length > 0 ? (
            filteredTimeline.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
              >
                {/* WPT 거래 */}
                {item.type === 'wpt' && (
                  <div className="card">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-3 flex-1">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                          style={{
                            backgroundColor: getWptColor(item.txType, item.amount).bg,
                          }}
                        >
                          {getWptIcon(item.txType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-title)' }}>
                            {item.description || 'WPT 거래'}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-sub)' }}>
                            {formatDateTime(item.date)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right ml-2">
                        <p
                          className="text-base font-bold"
                          style={{
                            color: getWptColor(item.txType, item.amount).text,
                          }}
                        >
                          {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString()}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>
                          잔액 {item.balance.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 배지 획득 */}
                {item.type === 'badge' && (
                  <div
                    className="card"
                    style={{
                      borderLeft: `4px solid ${getBadgeColor(item.badgeLevel).text}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                        style={{
                          background: getBadgeColor(item.badgeLevel).gradient,
                        }}
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.badgeName}
                            className="w-14 h-14 object-contain"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'block';
                            }}
                          />
                        ) : null}
                        <span style={{ display: item.imageUrl ? 'none' : 'block' }}>🏅</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text-title)' }}>
                            {item.badgeName}
                          </p>
                          <span
                            className="px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap"
                            style={{
                              backgroundColor: getBadgeColor(item.badgeLevel).bg,
                              color: getBadgeColor(item.badgeLevel).text,
                            }}
                          >
                            {item.badgeLevel}
                          </span>
                        </div>
                        <p className="text-xs mb-1 line-clamp-2" style={{ color: 'var(--color-text-sub)' }}>
                          {item.description}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>
                          {formatDateTime(item.date)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 근무 완료 */}
                {item.type === 'work' && (
                  <div className="card">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-3 flex-1">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                          style={{ backgroundColor: '#D1FAE5' }}
                        >
                          ✅
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-title)' }}>
                            {item.eventTitle}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-sub)' }}>
                            {formatDateShort(item.eventDate)} · {Math.floor(item.workedMinutes / 60)}시간 {item.workedMinutes % 60}분
                          </p>
                          <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>
                            {formatDateTime(item.checkOut)}
                          </p>
                        </div>
                      </div>
                      {item.payAmount && (
                        <div className="text-right ml-2">
                          <p className="text-base font-bold" style={{ color: 'var(--color-primary)' }}>
                            {formatPay(calculateNetPay(item.payAmount))}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>실수령</p>
                        </div>
                      )}
                    </div>
                    {item.txHash && (
                      <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>
                            블록체인 기록됨
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))
          ) : (
            <div className="card text-center py-12">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: 'var(--color-bg)' }}>
                📋
              </div>
              <p className="text-sm mb-2" style={{ color: 'var(--color-text-disabled)' }}>
                {filter === 'all' ? '아직 히스토리가 없습니다' : `${filter === 'wpt' ? 'WPT 거래' : filter === 'badge' ? '배지' : '근무'} 내역이 없습니다`}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
                활동을 시작하면 여기서 확인할 수 있어요
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
