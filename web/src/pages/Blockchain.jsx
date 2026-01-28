import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { chainAPI, creditsAPI } from '../api/client';
import { formatTime, formatWorkedTime } from '../utils/format';

export default function Blockchain() {
  const { user, worker } = useAuth();
  const [myLogs, setMyLogs] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [tokens, setTokens] = useState(0);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [networkStatus, setNetworkStatus] = useState(null);
  const [txHashInput, setTxHashInput] = useState('');
  const [verifyingTx, setVerifyingTx] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [verifiedData, setVerifiedData] = useState(null);

  // 출석체크 관련 상태
  const [checkinStatus, setCheckinStatus] = useState(null);
  const [checkingIn, setCheckingIn] = useState(false);

  // 크레딧 내역 모달
  const [showCreditHistory, setShowCreditHistory] = useState(false);
  const [creditHistory, setCreditHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const isAdmin = user?.is_admin || user?.role === 'admin';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    loadData();
  }, [worker, isAdmin]);

  const loadData = async () => {
    try {
      if (isAdmin) {
        const { data: status } = await chainAPI.getStatus();
        setNetworkStatus(status);

        // 관리자는 모든 로그 조회
        const { data: allData } = await chainAPI.getAllLogs(100, 0);
        setAllLogs(allData.logs || []);
      }

      if (worker) {
        const { data } = await chainAPI.getMyLogs();
        setMyLogs(data.logs || []);
        setTokens(data.tokens || 0);

        // 출석체크 상태 조회
        try {
          const { data: checkin } = await creditsAPI.getCheckinStatus();
          setCheckinStatus(checkin);
        } catch (e) {
          console.error('Failed to load checkin status:', e);
        }
      }
    } catch (error) {
      console.error('Failed to load blockchain data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async () => {
    if (checkingIn || checkinStatus?.checked_in_today) return;

    setCheckingIn(true);
    try {
      const { data } = await creditsAPI.checkin();
      alert(data.message);

      // 상태 갱신
      setTokens(data.new_balance);
      setCheckinStatus({
        checked_in_today: true,
        streak_days: data.streak_days,
        today_reward: data.reward_amount,
        next_reward: 1
      });
    } catch (error) {
      alert(error.response?.data?.detail || '출석체크에 실패했습니다');
    } finally {
      setCheckingIn(false);
    }
  };

  const loadCreditHistory = async () => {
    if (!worker) return;

    setLoadingHistory(true);
    try {
      const { data } = await creditsAPI.getMyHistory(50);
      setCreditHistory(data.history || []);
    } catch (error) {
      console.error('Failed to load credit history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const openCreditHistoryModal = () => {
    setShowCreditHistory(true);
    loadCreditHistory();
  };

  const handleVerify = async (log) => {
    setVerifying(log.id);
    try {
      const { data } = await chainAPI.verify(log.tx_hash);
      if (data.verified) {
        setSelectedLog(log);
        setVerifiedData(data);
      } else {
        alert('검증 실패: ' + (data.message || '기록을 찾을 수 없습니다'));
      }
    } catch (error) {
      alert('검증에 실패했습니다');
    } finally {
      setVerifying(null);
    }
  };

  const closeModal = () => {
    setSelectedLog(null);
    setVerifiedData(null);
  };

  const handleDownloadCertificate = async (log) => {
    if (tokens < 1) {
      alert('크레딧이 부족합니다. 관리자에게 문의하세요.');
      return;
    }

    if (!confirm(`근무증명서를 다운로드하시겠습니까?\n\n크레딧 1개가 차감됩니다.\n현재 크레딧: ${tokens}개`)) {
      return;
    }

    setDownloading(log.id);
    try {
      const response = await chainAPI.downloadCertificate(log.id);

      // PDF 다운로드
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `근무증명서_${log.event_title}_${log.event_date}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // 크레딧 갱신
      setTokens(prev => prev - 1);
      alert('근무증명서가 다운로드되었습니다.');
      closeModal();
    } catch (error) {
      alert(error.response?.data?.detail || '다운로드에 실패했습니다');
    } finally {
      setDownloading(null);
    }
  };

  const handleTxVerify = async () => {
    if (!txHashInput.trim()) {
      alert('TX Hash를 입력하세요');
      return;
    }

    setVerifyingTx(true);
    try {
      const { data } = await chainAPI.verify(txHashInput.trim());
      if (data.verified) {
        alert(`블록체인 검증 완료\n\n이벤트: ${data.event_title || '-'}\n날짜: ${data.event_date || '-'}`);
      } else {
        alert('검증 실패: ' + (data.message || '기록을 찾을 수 없습니다'));
      }
    } catch (error) {
      alert('검증에 실패했습니다');
    } finally {
      setVerifyingTx(false);
    }
  };

  const openPolygonscan = (hash) => {
    const txHash = hash || txHashInput.trim();
    if (txHash) {
      window.open(`https://amoy.polygonscan.com/tx/${txHash}`, '_blank');
    }
  };

  const handleAdminDownloadCertificate = async (log) => {
    if (!confirm(`${log.worker_name}님의 근무증명서를 다운로드하시겠습니까?`)) {
      return;
    }

    setDownloading(log.id);
    try {
      const response = await chainAPI.adminDownloadCertificate(log.id);

      // PDF 다운로드
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `근무증명서_${log.worker_name}_${log.event_title}_${log.event_date}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      alert('근무증명서가 다운로드되었습니다.');
    } catch (error) {
      alert(error.response?.data?.detail || '다운로드에 실패했습니다');
    } finally {
      setDownloading(null);
    }
  };

  const getStatusChip = (log) => {
    if (log.check_out_time) return <span className="chip-completed">퇴근</span>;
    if (log.check_in_time) return <span className="chip-confirmed">근무</span>;
    return <span className="chip-pending">대기</span>;
  };

  const shortenHash = (hash) => {
    if (!hash) return '-';
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
  };

  const shortenAddress = (addr) => {
    if (!addr) return '-';
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return dateStr.split(' ')[0];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
      </div>
    );
  }

  // 비로그인 사용자
  if (!user) {
    return (
      <div className="p-4 space-y-5 animate-fade-in">
        <div className="pt-1">
          <h1 className="text-xl font-bold text-gray-900">블록체인</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            근무 기록이 블록체인에 영구 저장됩니다
          </p>
        </div>
        <div className="card text-center py-10">
          <div className="text-4xl mb-3">🔐</div>
          <p className="text-gray-700 font-medium mb-2">로그인이 필요합니다</p>
          <p className="text-gray-500 text-sm mb-4">내 블록체인 기록을 확인하려면 로그인하세요</p>
          <Link to="/login" className="btn-primary inline-block px-6">
            로그인
          </Link>
        </div>
      </div>
    );
  }

  const currentLogs = myLogs;

  return (
    <div className="p-4 space-y-5 animate-fade-in">
      {/* 헤더 */}
      <div className="pt-1">
        <h1 className="text-xl font-bold text-gray-900">블록체인</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          근무 기록이 블록체인에 영구 저장됩니다
        </p>
      </div>

      {/* 네트워크 상태 (관리자용) */}
      {isAdmin && networkStatus && (
        <div className="card" style={{ background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-white font-semibold">네트워크 상태</span>
            <span className="flex items-center gap-1.5 text-xs text-white/80">
              <span className={`w-1.5 h-1.5 rounded-full ${networkStatus.connected ? 'bg-green-400' : 'bg-red-400'}`}></span>
              {networkStatus.connected ? '연결됨' : '연결 안됨'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-bold text-white">{networkStatus.balance_matic?.toFixed(2) || '0'}</p>
              <p className="text-xs text-white/60">MATIC</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white">{networkStatus.confirmed_logs || 0}</p>
              <p className="text-xs text-white/60">확정 기록</p>
            </div>
            <div>
              <p className="text-lg font-bold text-amber-400">{networkStatus.pending_logs || 0}</p>
              <p className="text-xs text-white/60">대기 기록</p>
            </div>
          </div>

          {networkStatus.wallet_address && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <a
                href={`https://amoy.polygonscan.com/address/${networkStatus.wallet_address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-300 font-mono"
              >
                {shortenAddress(networkStatus.wallet_address)} &rarr;
              </a>
            </div>
          )}
        </div>
      )}

      {/* 일일 출석체크 (근무자) */}
      {worker && (
        <div className="card" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold" style={{ color: 'var(--color-text-title)' }}>일일 출석체크</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-sub)' }}>
                매일 출석체크하고 크레딧을 받으세요
              </p>
            </div>
            {checkinStatus && (
              <div className="text-right">
                <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>연속 출석</p>
                <p className="font-bold text-lg" style={{ color: 'var(--color-primary)' }}>
                  {checkinStatus.streak_days}일
                </p>
              </div>
            )}
          </div>

          {checkinStatus?.checked_in_today ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl" style={{ backgroundColor: 'var(--color-success-light)' }}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--color-success)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium" style={{ color: 'var(--color-success)' }}>
                오늘 출석완료! +{checkinStatus.today_reward} 크레딧
              </span>
            </div>
          ) : (
            <button
              onClick={handleCheckin}
              disabled={checkingIn}
              className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {checkingIn ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  출석체크 중...
                </>
              ) : (
                <>
                  <span className="text-lg">👆</span>
                  출석체크 (+{checkinStatus?.next_reward || 1} 크레딧)
                </>
              )}
            </button>
          )}

          {checkinStatus && checkinStatus.streak_days > 0 && !checkinStatus.checked_in_today && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--color-text-disabled)' }}>
              7일 연속 출석 시 보너스 크레딧!
            </p>
          )}
        </div>
      )}

      {/* 크레딧 표시 (근무자) - 클릭하면 내역 표시 */}
      {worker && (
        <div
          className="card cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)' }}
          onClick={openCreditHistoryModal}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-200 text-xs">내 크레딧</p>
              <p className="text-white text-sm mt-0.5">탭하여 사용내역 보기</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-white">{tokens}</span>
              <span className="text-purple-200 text-sm">개</span>
              <span className="text-purple-200">&rarr;</span>
            </div>
          </div>
        </div>
      )}

      {/* TX 검증 */}
      <div className="card">
        <p className="text-sm font-medium text-gray-700 mb-2">트랜잭션 검증</p>
        <input
          type="text"
          value={txHashInput}
          onChange={(e) => setTxHashInput(e.target.value)}
          placeholder="TX Hash 입력 (0x...)"
          className="input font-mono text-xs mb-3"
        />
        <div className="flex gap-2">
          <button
            onClick={() => openPolygonscan()}
            disabled={!txHashInput.trim()}
            className="flex-1 btn-secondary text-xs py-2"
          >
            Polygonscan
          </button>
          <button
            onClick={handleTxVerify}
            disabled={!txHashInput.trim() || verifyingTx}
            className="flex-1 btn-primary text-xs py-2"
          >
            {verifyingTx ? '검증 중...' : '검증하기'}
          </button>
        </div>
      </div>

      {/* 관리자: 모든 근무자 기록 */}
      {isAdmin && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">모든 근무자 블록체인 기록</h2>
            <span className="text-sm text-gray-500">{allLogs.length}건</span>
          </div>

          <div>
            {allLogs.length > 0 ? (
              <div className="space-y-2">
                {allLogs.map((log) => (
                  <div key={log.id} className="card">
                    {/* 상단: 행사명 + 상태 */}
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div>
                        <h3 className="font-semibold text-base">{log.event_title || '행사'}</h3>
                        <p className="text-xs text-gray-500">
                          {formatDate(log.event_date)} · {log.worker_name || '근무자'}
                        </p>
                      </div>
                      {getStatusChip(log)}
                    </div>

                    {/* 근무 시간 */}
                    {log.check_in_time && (
                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                        <span>출근 {formatTime(log.check_in_time)}</span>
                        {log.check_out_time && (
                          <span>퇴근 {formatTime(log.check_out_time)}</span>
                        )}
                        {log.worked_minutes && (
                          <span className="font-medium text-gray-700">
                            {formatWorkedTime(log.worked_minutes)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* TX Hash */}
                    {log.tx_hash ? (
                      <div className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2 mb-2">
                        <span className="text-gray-500">TX</span>
                        <button
                          onClick={() => openPolygonscan(log.tx_hash)}
                          className="font-mono text-blue-600"
                        >
                          {shortenHash(log.tx_hash)} &rarr;
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 mb-2">
                        블록체인 기록 대기중
                      </div>
                    )}

                    {/* 관리자 다운로드 버튼 */}
                    {log.tx_hash && (
                      <button
                        onClick={() => handleAdminDownloadCertificate(log)}
                        disabled={downloading === log.id}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-3 rounded-xl disabled:bg-gray-300 transition-colors"
                      >
                        {downloading === log.id ? '다운로드 중...' : '블록체인 업무증명서 다운로드'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <span className="text-2xl text-gray-400">⛓️</span>
                </div>
                <p className="empty-state-title">블록체인 기록이 없습니다</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* 내 기록 헤더 */}
      {worker && !isAdmin && (
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">내 블록체인 기록</h2>
          <span className="text-sm text-gray-500">{myLogs.length}건</span>
        </div>
      )}

      {/* 기록 목록 (일반 사용자만) */}
      {!isAdmin && <div>
        {currentLogs.length > 0 ? (
          <div className="space-y-2">
            {currentLogs.map((log) => (
              <div key={log.id} className="card">
                {/* 상단: 행사명 + 상태 */}
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div>
                    <h3 className="font-semibold text-base">{log.event_title || '행사'}</h3>
                    <p className="text-xs text-gray-500">
                      {formatDate(log.event_date)}
                    </p>
                  </div>
                  {getStatusChip(log)}
                </div>

                {/* 근무 시간 */}
                {log.check_in_time && (
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                    <span>출근 {formatTime(log.check_in_time)}</span>
                    {log.check_out_time && (
                      <span>퇴근 {formatTime(log.check_out_time)}</span>
                    )}
                    {log.worked_minutes && (
                      <span className="font-medium text-gray-700">
                        {formatWorkedTime(log.worked_minutes)}
                      </span>
                    )}
                  </div>
                )}

                {/* TX Hash */}
                {log.tx_hash ? (
                  <div className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2 mb-2">
                    <span className="text-gray-500">TX</span>
                    <button
                      onClick={() => openPolygonscan(log.tx_hash)}
                      className="font-mono text-blue-600"
                    >
                      {shortenHash(log.tx_hash)} &rarr;
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 mb-2">
                    블록체인 기록 대기중
                  </div>
                )}

                {/* 버튼들 */}
                <div className="flex gap-2">
                  {log.tx_hash && (
                    <button
                      onClick={() => handleVerify(log)}
                      disabled={verifying === log.id}
                      className="flex-1 btn-outline text-xs py-2"
                    >
                      {verifying === log.id ? '검증 중...' : '검증'}
                    </button>
                  )}

                  {/* 증명서 다운로드 */}
                  {log.tx_hash && (
                    <button
                      onClick={() => handleDownloadCertificate(log)}
                      disabled={downloading === log.id || tokens < 1}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-3 rounded-xl disabled:bg-gray-300 transition-colors"
                    >
                      {downloading === log.id ? '다운로드...' : '블록체인 업무증명서 (1크레딧)'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <span className="text-2xl text-gray-400">⛓️</span>
            </div>
            <p className="empty-state-title">내 블록체인 기록이 없습니다</p>
            <p className="empty-state-desc">출퇴근 시 자동으로 기록됩니다</p>
          </div>
        )}
      </div>}

      {/* 검증 완료 모달 */}
      {selectedLog && verifiedData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            {/* 헤더 */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-5 py-4 text-white">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold">블록체인 검증 완료</span>
              </div>
              <p className="text-green-100 text-sm">이 근무 기록은 블록체인에 안전하게 저장되었습니다</p>
            </div>

            {/* 내용 */}
            <div className="p-5 space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">행사명</span>
                  <span className="font-medium">{verifiedData.event_title || selectedLog.event_title}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 text-sm">근무일</span>
                  <span className="font-medium">{verifiedData.event_date || selectedLog.event_date}</span>
                </div>
                {selectedLog.worker_name && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500 text-sm">근무자</span>
                    <span className="font-medium">{selectedLog.worker_name}</span>
                  </div>
                )}
                {selectedLog.check_in_time && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500 text-sm">출근</span>
                    <span className="font-medium">{formatTime(selectedLog.check_in_time)}</span>
                  </div>
                )}
                {selectedLog.check_out_time && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500 text-sm">퇴근</span>
                    <span className="font-medium">{formatTime(selectedLog.check_out_time)}</span>
                  </div>
                )}
                {selectedLog.worked_minutes && (
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500 text-sm">근무시간</span>
                    <span className="font-medium">{formatWorkedTime(selectedLog.worked_minutes)}</span>
                  </div>
                )}
              </div>

              {/* TX Hash */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">TX Hash</p>
                <button
                  onClick={() => openPolygonscan(selectedLog.tx_hash)}
                  className="font-mono text-xs text-blue-600 break-all"
                >
                  {selectedLog.tx_hash}
                </button>
              </div>

              {/* 버튼들 */}
              <div className="space-y-2 pt-2">
                {/* 근무증명서 다운로드 - 근무자 본인 기록만 */}
                {worker && myLogs.some(l => l.id === selectedLog.id) && (
                  <button
                    onClick={() => handleDownloadCertificate(selectedLog)}
                    disabled={downloading === selectedLog.id || tokens < 1}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
                  >
                    {downloading === selectedLog.id ? '다운로드 중...' : tokens < 1 ? '크레딧 부족' : `블록체인 업무증명서 다운로드 (1크레딧)`}
                  </button>
                )}
                <button
                  onClick={closeModal}
                  className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 크레딧 내역 모달 */}
      {showCreditHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center sm:justify-center z-50">
          <div className="bg-white w-full sm:w-[420px] sm:max-w-[90vw] rounded-t-3xl sm:rounded-2xl max-h-[80vh] overflow-hidden animate-slide-up">
            {/* 헤더 */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-title)' }}>크레딧 내역</h2>
                <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>현재 잔액: {tokens} 크레딧</p>
              </div>
              <button
                onClick={() => setShowCreditHistory(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full"
                style={{ backgroundColor: 'var(--color-bg)' }}
              >
                <span className="text-xl" style={{ color: 'var(--color-text-secondary)' }}>×</span>
              </button>
            </div>

            {/* 내역 목록 */}
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 70px)' }}>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
                </div>
              ) : creditHistory.length > 0 ? (
                <div className="space-y-2">
                  {creditHistory.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-3 border-b"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                          style={{
                            backgroundColor: item.amount > 0 ? 'var(--color-success-light)' : 'var(--color-error-light)'
                          }}
                        >
                          {item.tx_type === 'CHECKIN' ? '👆' :
                           item.tx_type === 'MINT' ? '💰' :
                           item.tx_type === 'BURN' ? '📄' : '💎'}
                        </div>
                        <div>
                          <p className="font-medium text-sm" style={{ color: 'var(--color-text-title)' }}>
                            {item.reason}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
                            {item.created_at?.split(' ')[0] || '-'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className="font-bold"
                          style={{ color: item.amount > 0 ? 'var(--color-success)' : 'var(--color-error)' }}
                        >
                          {item.amount > 0 ? '+' : ''}{item.amount}
                        </p>
                        {item.balance_after !== null && (
                          <p className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
                            잔액 {item.balance_after}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="text-4xl mb-3">💎</div>
                  <p style={{ color: 'var(--color-text-secondary)' }}>크레딧 내역이 없습니다</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--color-text-disabled)' }}>
                    출석체크로 크레딧을 받아보세요
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
