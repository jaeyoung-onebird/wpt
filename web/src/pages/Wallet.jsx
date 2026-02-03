import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { creditsAPI, chainAPI } from '../api/client';
import { formatTime, formatWorkedTime } from '../utils/format';

export default function Wallet() {
  const { user, worker } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [history, setHistory] = useState([]);
  const [checkinStatus, setCheckinStatus] = useState(null);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('balance'); // balance, blockchain, collection, info

  // 블록체인 기록 관련
  const [myLogs, setMyLogs] = useState([]);
  const [verifying, setVerifying] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [networkStatus, setNetworkStatus] = useState(null);

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
      const isAdmin = user?.is_admin || user?.role === 'admin';

      const requests = [
        creditsAPI.getMyBalance().catch(() => ({ data: { balance: 0 } })),
        creditsAPI.getMyHistory(50).catch(() => ({ data: { history: [] } })),
        creditsAPI.getCheckinStatus().catch(() => ({ data: null })),
        creditsAPI.getTokenInfo().catch(() => ({ data: null })),
        chainAPI.getMyLogs().catch(() => ({ data: { logs: [] } })),
      ];

      // 관리자인 경우 네트워크 상태도 조회
      if (isAdmin) {
        requests.push(chainAPI.getStatus().catch(() => ({ data: null })));
      }

      const results = await Promise.all(requests);
      const [balanceRes, historyRes, checkinRes, tokenRes, logsRes, statusRes] = results;

      setBalance(balanceRes.data.balance || 0);
      setHistory(historyRes.data.history || []);
      setCheckinStatus(checkinRes.data);
      setTokenInfo(tokenRes.data);
      setMyLogs(logsRes.data.logs || []);

      if (isAdmin && statusRes) {
        setNetworkStatus(statusRes.data);
      }
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

  const getTxTypeLabel = (type, reason) => {
    // reason이 있으면 사용
    if (type === 'BURN' && reason) {
      const cleaned = formatReason(reason);
      if (cleaned) return cleaned;
    }

    const labels = {
      'MINT': '지급',
      'BURN': '크레딧 사용',
      'CHECKIN': '출석체크',
      'WORK_REWARD': '근무보상',
      'BADGE_REWARD': '배지보상',
      'REFERRAL': '추천인보상',
      'EVENT_BONUS': '이벤트보너스',
      'SIGNUP_BONUS': '가입 보너스',
    };
    return labels[type] || type;
  };

  const getTxTypeColor = (type) => {
    if (type === 'BURN') return 'var(--color-error)';
    return 'var(--color-primary)';
  };

  const formatReason = (reason) => {
    if (!reason) return '';
    // 개발자용 문구 제거 (log_id, worker_id 등)
    return reason.replace(/\s*\((?:log_id|worker_id|tx_hash):\s*\d+\)/gi, '').trim();
  };

  // 블록체인 관련 헬퍼 함수
  const shortenHash = (hash) => {
    if (!hash) return '-';
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
  };

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '-';
    return dateStr.split(' ')[0];
  };

  const getStatusChip = (log) => {
    if (log.check_out_time) return <span className="chip-completed">퇴근</span>;
    if (log.check_in_time) return <span className="chip-confirmed">근무</span>;
    return <span className="chip-pending">대기</span>;
  };

  const openPolygonscan = (hash) => {
    if (hash) {
      window.open(`https://amoy.polygonscan.com/tx/${hash}`, '_blank');
    }
  };

  const shortenAddress = (addr) => {
    if (!addr) return '-';
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  const handleVerify = async (log) => {
    setVerifying(log.id);
    try {
      const { data } = await chainAPI.verify(log.tx_hash);
      if (data.verified) {
        alert(`블록체인 검증 완료\n\n이벤트: ${data.event_title || log.event_title}\n날짜: ${data.event_date || log.event_date}`);
      } else {
        alert('검증 실패: ' + (data.message || '기록을 찾을 수 없습니다'));
      }
    } catch (error) {
      alert('검증에 실패했습니다');
    } finally {
      setVerifying(null);
    }
  };

  const handleDownloadCertificate = async (log) => {
    if (balance < 1) {
      alert('크레딧이 부족합니다. 출석체크로 크레딧을 받으세요.');
      return;
    }

    if (!confirm(`근무증명서를 다운로드하시겠습니까?\n\n크레딧 1개가 차감됩니다.\n현재 크레딧: ${balance}개`)) {
      return;
    }

    setDownloading(log.id);
    try {
      const response = await chainAPI.downloadCertificate(log.id);

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `근무증명서_${log.event_title}_${log.event_date}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setBalance(prev => prev - 1);
      alert('근무증명서가 다운로드되었습니다.');

      // 거래내역 새로고침
      const historyRes = await creditsAPI.getMyHistory(50);
      setHistory(historyRes.data.history || []);
    } catch (error) {
      alert(error.response?.data?.detail || '다운로드에 실패했습니다');
    } finally {
      setDownloading(null);
    }
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

  const isAdmin = user?.is_admin || user?.role === 'admin';

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* 헤더 */}
      <div className="pt-2">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-title)' }}>WPT 지갑</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-sub)' }}>WorkProof Token</p>
      </div>

      {/* 네트워크 상태 (관리자용) */}
      {isAdmin && networkStatus && (
        <div className="card" style={{ background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/80 text-sm mb-1">네트워크 상태</p>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${networkStatus.connected ? 'bg-green-400' : 'bg-red-400'}`}></span>
                <span className="text-white text-sm font-medium">{networkStatus.connected ? '연결됨' : '연결 안됨'}</span>
              </div>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl">
              ⛓️
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-white/10 rounded-lg p-2.5">
              <p className="text-white/60 text-xs mb-0.5">MATIC</p>
              <p className="text-white text-sm font-semibold">{networkStatus.balance_matic?.toFixed(2) || '0'}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-2.5">
              <p className="text-white/60 text-xs mb-0.5">확정 기록</p>
              <p className="text-white text-sm font-semibold">{networkStatus.confirmed_logs || 0}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-2.5">
              <p className="text-white/60 text-xs mb-0.5">대기 기록</p>
              <p className="text-amber-400 text-sm font-semibold">{networkStatus.pending_logs || 0}</p>
            </div>
          </div>

          {networkStatus.wallet_address && (
            <div className="bg-white/10 rounded-lg p-2.5">
              <p className="text-white/60 text-xs mb-1">지갑 주소</p>
              <a
                href={`https://amoy.polygonscan.com/address/${networkStatus.wallet_address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-300 text-xs font-mono hover:text-blue-200 transition-colors"
              >
                {shortenAddress(networkStatus.wallet_address)} →
              </a>
            </div>
          )}
        </div>
      )}

      {/* 잔액 카드 */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/80 text-sm mb-1">내 보유 크레딧</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-white">{formatNumber(balance)}</p>
              <p className="text-white/70 text-lg font-medium">WPT</p>
            </div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl">
            💰
          </div>
        </div>

        {/* 토큰 정보 */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-white/10 rounded-lg p-2.5">
            <p className="text-white/60 text-xs mb-0.5">토큰 심볼</p>
            <p className="text-white text-sm font-semibold">WPT</p>
          </div>
          <div className="bg-white/10 rounded-lg p-2.5">
            <p className="text-white/60 text-xs mb-0.5">네트워크</p>
            <p className="text-white text-sm font-semibold">Polygon</p>
          </div>
          <div className="bg-white/10 rounded-lg p-2.5">
            <p className="text-white/60 text-xs mb-0.5">출석 스트릭</p>
            <p className="text-white text-sm font-semibold">{checkinStatus?.streak || 0}일 🔥</p>
          </div>
          <div className="bg-white/10 rounded-lg p-2.5">
            <p className="text-white/60 text-xs mb-0.5">총 거래</p>
            <p className="text-white text-sm font-semibold">{history.length}건</p>
          </div>
        </div>

        {/* 출석체크 버튼 */}
        <button
          onClick={handleCheckin}
          disabled={checkinLoading || checkinStatus?.checked_in_today}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
            checkinStatus?.checked_in_today
              ? 'bg-white/20 text-white/50 cursor-not-allowed'
              : 'bg-white hover:bg-white/90'
          }`}
          style={{ color: checkinStatus?.checked_in_today ? undefined : '#334155' }}
        >
          {checkinLoading ? (
            '처리중...'
          ) : checkinStatus?.checked_in_today ? (
            <>오늘 출석 완료 {checkinStatus.streak > 1 && `(${checkinStatus.streak}일 연속)`}</>
          ) : (
            '출석체크하고 WPT 받기'
          )}
        </button>
        {!checkinStatus?.checked_in_today && (
          <p className="text-center text-xs text-white/60 mt-2">
            매일 출석하면 10 WPT를 받을 수 있어요
          </p>
        )}
      </div>

      {/* 탭 */}
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={() => setActiveTab('balance')}
          className={`py-2.5 rounded-xl text-xs font-medium transition-all`}
          style={{
            backgroundColor: activeTab === 'balance' ? 'var(--color-primary)' : 'var(--color-bg)',
            color: activeTab === 'balance' ? 'white' : 'var(--color-text-secondary)'
          }}
        >
          거래내역
        </button>
        <button
          onClick={() => setActiveTab('blockchain')}
          className={`py-2.5 rounded-xl text-xs font-medium transition-all`}
          style={{
            backgroundColor: activeTab === 'blockchain' ? 'var(--color-primary)' : 'var(--color-bg)',
            color: activeTab === 'blockchain' ? 'white' : 'var(--color-text-secondary)'
          }}
        >
          블록체인
        </button>
        <button
          onClick={() => navigate('/collection')}
          className={`py-2.5 rounded-xl text-xs font-medium transition-all`}
          style={{
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text-secondary)'
          }}
        >
          컬렉션
        </button>
        <button
          onClick={() => setActiveTab('info')}
          className={`py-2.5 rounded-xl text-xs font-medium transition-all`}
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
                        {getTxTypeLabel(tx.tx_type, tx.reason)}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>
                        {formatDate(tx.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-sm font-bold"
                      style={{ color: getTxTypeColor(tx.tx_type) }}
                    >
                      {tx.tx_type === 'BURN' ? '-' : '+'}{formatNumber(Math.abs(tx.amount))}
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

      {/* 블록체인 기록 탭 */}
      {activeTab === 'blockchain' && (
        <div className="card">
          <h3 className="font-semibold mb-3" style={{ color: 'var(--color-text-title)' }}>내 블록체인 기록</h3>
          {myLogs.length > 0 ? (
            <div className="space-y-3">
              {myLogs.map((log) => (
                <div key={log.id} className="pb-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {/* 상단: 행사명 + 상태 */}
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div>
                      <h4 className="font-semibold text-sm" style={{ color: 'var(--color-text-title)' }}>
                        {log.event_title || '행사'}
                      </h4>
                      <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>
                        {formatDateShort(log.event_date)}
                      </p>
                    </div>
                    {getStatusChip(log)}
                  </div>

                  {/* 근무 시간 */}
                  {log.check_in_time && (
                    <div className="flex items-center gap-2 text-xs mb-2" style={{ color: 'var(--color-text-sub)' }}>
                      <span>출근 {formatTime(log.check_in_time)}</span>
                      {log.check_out_time && (
                        <span>퇴근 {formatTime(log.check_out_time)}</span>
                      )}
                      {log.worked_minutes && (
                        <span className="font-medium" style={{ color: 'var(--color-text-title)' }}>
                          {formatWorkedTime(log.worked_minutes)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* TX Hash */}
                  {log.tx_hash ? (
                    <div className="flex items-center justify-between text-xs rounded-lg px-3 py-2 mb-2" style={{ backgroundColor: 'var(--color-bg)' }}>
                      <span style={{ color: 'var(--color-text-sub)' }}>TX</span>
                      <button
                        onClick={() => openPolygonscan(log.tx_hash)}
                        className="font-mono"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {shortenHash(log.tx_hash)} →
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs rounded-lg px-3 py-2 mb-2" style={{ color: 'var(--color-text-disabled)', backgroundColor: 'var(--color-bg)' }}>
                      블록체인 기록 대기중
                    </div>
                  )}

                  {/* 버튼들 */}
                  {log.tx_hash && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVerify(log)}
                        disabled={verifying === log.id}
                        className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                        style={{
                          backgroundColor: 'var(--color-bg)',
                          color: 'var(--color-text-secondary)',
                          border: '1px solid var(--color-border)'
                        }}
                      >
                        {verifying === log.id ? '검증 중...' : '검증'}
                      </button>
                      <button
                        onClick={() => handleDownloadCertificate(log)}
                        disabled={downloading === log.id || balance < 1}
                        className="flex-1 py-2 rounded-lg text-xs font-semibold text-white transition-all"
                        style={{
                          backgroundColor: balance < 1 ? 'var(--color-bg-disabled)' : 'var(--color-primary)'
                        }}
                      >
                        {downloading === log.id ? '다운로드...' : '증명서 (1WPT)'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: 'var(--color-bg)' }}>
                ⛓️
              </div>
              <p className="text-sm" style={{ color: 'var(--color-text-disabled)' }}>블록체인 기록이 없습니다</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-disabled)' }}>출퇴근 시 자동으로 기록됩니다</p>
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
