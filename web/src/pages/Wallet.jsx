import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { creditsAPI, chainAPI } from '../api/client';

export default function Wallet() {
  const { user, worker } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [history, setHistory] = useState([]);
  const [checkinStatus, setCheckinStatus] = useState(null);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('balance'); // balance, history, info

  useEffect(() => {
    window.scrollTo(0, 0);
    if (worker) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [worker]);

  const loadData = async () => {
    try {
      const [balanceRes, historyRes, checkinRes, tokenRes] = await Promise.all([
        creditsAPI.getMyBalance().catch(() => ({ data: { balance: 0 } })),
        creditsAPI.getMyHistory(50).catch(() => ({ data: { history: [] } })),
        creditsAPI.getCheckinStatus().catch(() => ({ data: null })),
        creditsAPI.getTokenInfo().catch(() => ({ data: null })),
      ]);

      setBalance(balanceRes.data.balance || 0);
      setHistory(historyRes.data.history || []);
      setCheckinStatus(checkinRes.data);
      setTokenInfo(tokenRes.data);
    } catch (error) {
      console.error('Failed to load wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async () => {
    if (checkinLoading || checkinStatus?.checked_in_today) return;

    setCheckinLoading(true);
    try {
      const { data } = await creditsAPI.checkin();
      setCheckinStatus({ ...checkinStatus, checked_in_today: true, streak: data.streak });
      setBalance(prev => prev + (data.reward || 10));
      // 히스토리 새로고침
      const historyRes = await creditsAPI.getMyHistory(50);
      setHistory(historyRes.data.history || []);
    } catch (error) {
      alert(error.response?.data?.detail || '출석체크에 실패했습니다');
    } finally {
      setCheckinLoading(false);
    }
  };

  const formatNumber = (num) => {
    return Number(num || 0).toLocaleString();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}월 ${date.getDate()}일 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const getTxTypeLabel = (type) => {
    const labels = {
      'MINT': '지급',
      'BURN': '사용',
      'CHECKIN': '출석체크',
      'WORK_REWARD': '근무보상',
      'BADGE_REWARD': '배지보상',
      'REFERRAL': '추천인보상',
      'EVENT_BONUS': '이벤트보너스',
    };
    return labels[type] || type;
  };

  const getTxTypeColor = (type) => {
    if (type === 'BURN') return 'var(--color-error)';
    return 'var(--color-primary)';
  };

  if (!user) {
    return (
      <div className="p-4 animate-fade-in">
        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: 'var(--color-bg)' }}>
            🔒
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text-title)' }}>로그인이 필요합니다</p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-sub)' }}>WPT 지갑을 확인하려면 로그인해주세요</p>
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
            💰
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text-title)' }}>회원등록이 필요합니다</p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-sub)' }}>WPT를 받으려면 회원등록을 완료해주세요</p>
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
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-title)' }}>WPT 지갑</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-sub)' }}>WorkProof Token</p>
      </div>

      {/* 잔액 카드 */}
      <div className="card" style={{ background: 'linear-gradient(135deg, var(--color-navy) 0%, var(--color-navy-light) 100%)' }}>
        <div className="text-center py-4">
          <p className="text-white/60 text-sm mb-2">보유 WPT</p>
          <p className="text-4xl font-bold text-white mb-1">{formatNumber(balance)}</p>
          <p className="text-white/60 text-xs">WPT</p>
        </div>

        {/* 출석체크 버튼 */}
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={handleCheckin}
            disabled={checkinLoading || checkinStatus?.checked_in_today}
            className={`w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
              checkinStatus?.checked_in_today
                ? 'bg-white/20 text-white/50 cursor-not-allowed'
                : 'bg-white text-navy'
            }`}
            style={{ color: checkinStatus?.checked_in_today ? 'rgba(255,255,255,0.5)' : 'var(--color-navy)' }}
          >
            {checkinLoading ? (
              '처리중...'
            ) : checkinStatus?.checked_in_today ? (
              <>오늘 출석 완료 {checkinStatus.streak > 1 && `(${checkinStatus.streak}일 연속)`}</>
            ) : (
              <>출석체크하고 WPT 받기</>
            )}
          </button>
          {!checkinStatus?.checked_in_today && (
            <p className="text-center text-xs text-white/50 mt-2">
              매일 출석하면 WPT를 받을 수 있어요
            </p>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('balance')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all`}
          style={{
            backgroundColor: activeTab === 'balance' ? 'var(--color-primary)' : 'var(--color-bg)',
            color: activeTab === 'balance' ? 'white' : 'var(--color-text-secondary)'
          }}
        >
          거래내역
        </button>
        <button
          onClick={() => setActiveTab('info')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all`}
          style={{
            backgroundColor: activeTab === 'info' ? 'var(--color-primary)' : 'var(--color-bg)',
            color: activeTab === 'info' ? 'white' : 'var(--color-text-secondary)'
          }}
        >
          토큰정보
        </button>
      </div>

      {/* 거래내역 탭 */}
      {activeTab === 'balance' && (
        <div className="card">
          <h3 className="font-semibold mb-3" style={{ color: 'var(--color-text-title)' }}>거래내역</h3>
          {history.length > 0 ? (
            <div className="space-y-0">
              {history.map((tx, idx) => (
                <div
                  key={tx.id || idx}
                  className="flex items-center justify-between py-3"
                  style={{ borderBottom: idx < history.length - 1 ? '1px solid var(--color-border)' : 'none' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                      style={{ backgroundColor: tx.tx_type === 'BURN' ? '#FEE2E2' : 'var(--color-primary-light)' }}
                    >
                      {tx.tx_type === 'BURN' ? '📤' : tx.tx_type === 'CHECKIN' ? '📅' : '📥'}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text-title)' }}>
                        {getTxTypeLabel(tx.tx_type)}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>
                        {tx.reason || formatDate(tx.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-sm font-bold"
                      style={{ color: getTxTypeColor(tx.tx_type) }}
                    >
                      {tx.tx_type === 'BURN' ? '-' : '+'}{formatNumber(tx.amount)}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>WPT</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: 'var(--color-bg)' }}>
                📋
              </div>
              <p className="text-sm" style={{ color: 'var(--color-text-disabled)' }}>거래내역이 없습니다</p>
            </div>
          )}
        </div>
      )}

      {/* 토큰정보 탭 */}
      {activeTab === 'info' && (
        <div className="card">
          <h3 className="font-semibold mb-3" style={{ color: 'var(--color-text-title)' }}>WPT 토큰 정보</h3>
          <div className="space-y-0">
            <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>토큰 이름</span>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-title)' }}>WorkProof Token</span>
            </div>
            <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>심볼</span>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-title)' }}>WPT</span>
            </div>
            <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>네트워크</span>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-title)' }}>Polygon</span>
            </div>
            {tokenInfo?.total_supply && (
              <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>총 발행량</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-title)' }}>{formatNumber(tokenInfo.total_supply)} WPT</span>
              </div>
            )}
            {tokenInfo?.contract_address && (
              <div className="py-3">
                <span className="text-sm block mb-1" style={{ color: 'var(--color-text-sub)' }}>컨트랙트 주소</span>
                <span className="text-xs font-mono break-all" style={{ color: 'var(--color-text-secondary)' }}>
                  {tokenInfo.contract_address}
                </span>
              </div>
            )}
          </div>

          {/* WPT 획득 방법 */}
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-title)' }}>WPT 획득 방법</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 py-2 px-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
                <span className="text-lg">📅</span>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-title)' }}>매일 출석체크</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>하루 1회 10 WPT</p>
                </div>
              </div>
              <div className="flex items-center gap-2 py-2 px-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
                <span className="text-lg">💼</span>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-title)' }}>근무 완료</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>근무 완료시 WPT 지급</p>
                </div>
              </div>
              <div className="flex items-center gap-2 py-2 px-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
                <span className="text-lg">🏅</span>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-title)' }}>배지 획득</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>새로운 배지 획득시 보너스</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
