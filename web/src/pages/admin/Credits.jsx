import { useState, useEffect } from 'react';
import { adminAPI, creditsAPI, workersAPI } from '../../api/client';

export default function AdminCredits() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [tokenStats, setTokenStats] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [workerBalance, setWorkerBalance] = useState(null);
  const [mintAmount, setMintAmount] = useState(1);
  const [mintReason, setMintReason] = useState('');
  const [minting, setMinting] = useState(false);

  // 탭 상태
  const [activeTab, setActiveTab] = useState('holders'); // holders, history
  const [txHistory, setTxHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [txTypeFilter, setTxTypeFilter] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadData();
  }, []);

  // 탭 변경 시 거래 내역 로드
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, txTypeFilter]);

  const loadData = async () => {
    try {
      const [workersRes, tokenInfoRes, statsRes] = await Promise.all([
        creditsAPI.getWorkersWithBadges(),
        creditsAPI.getTokenInfo(),
        creditsAPI.getAdminStats()
      ]);

      const workersList = workersRes.data.workers || [];
      setWorkers(workersList);
      setTokenInfo(tokenInfoRes.data);
      setTokenStats(statsRes.data);
      setLoading(false);

      // 모든 근무자의 실제 WPT 잔액 로드
      const balancePromises = workersList.map(async (worker) => {
        try {
          const { data } = await creditsAPI.getWorkerBalance(worker.id);
          return { id: worker.id, balance: data.balance };
        } catch {
          return { id: worker.id, balance: 0 };
        }
      });

      const balances = await Promise.all(balancePromises);
      setWorkers(prev => prev.map(w => {
        const found = balances.find(b => b.id === w.id);
        return found ? { ...w, tokens: found.balance } : w;
      }));
    } catch (error) {
      console.error('Failed to load data:', error);
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await creditsAPI.getAdminHistory(100, 0, txTypeFilter);
      setTxHistory(data.history || []);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSelectWorker = async (worker) => {
    setSelectedWorker(worker);
    setWorkerBalance(null);
    setMintAmount(1);
    setMintReason('');

    try {
      const { data } = await creditsAPI.getWorkerBalance(worker.id);
      setWorkerBalance(data);
    } catch (error) {
      console.error('Failed to load balance:', error);
      setWorkerBalance({ balance: 0 });
    }
  };

  const handleMint = async () => {
    if (!selectedWorker || mintAmount < 1) return;
    if (!mintReason.trim()) {
      alert('발행 사유를 입력하세요');
      return;
    }

    setMinting(true);
    try {
      await creditsAPI.mint(selectedWorker.id, mintAmount, mintReason);
      alert(`${mintAmount} 크레딧이 발행되었습니다`);

      // 잔액 새로고침
      const balanceRes = await creditsAPI.getWorkerBalance(selectedWorker.id);
      setWorkerBalance(balanceRes.data);

      // 목록의 해당 근무자 토큰도 업데이트
      setWorkers(prev => prev.map(w =>
        w.id === selectedWorker.id
          ? { ...w, tokens: balanceRes.data.balance }
          : w
      ));

      // 토큰 정보/통계 새로고침
      const [tokenInfoRes, statsRes] = await Promise.all([
        creditsAPI.getTokenInfo(),
        creditsAPI.getAdminStats()
      ]);
      setTokenInfo(tokenInfoRes.data);
      setTokenStats(statsRes.data);

      setMintAmount(1);
      setMintReason('');
    } catch (error) {
      alert(error.response?.data?.detail || '발행에 실패했습니다');
    } finally {
      setMinting(false);
    }
  };

  const filteredWorkers = workers.filter(
    (w) =>
      w.name?.toLowerCase().includes(search.toLowerCase()) ||
      w.phone?.includes(search)
  );

  // 거래 유형 라벨
  const getTxTypeLabel = (type) => {
    const labels = {
      'MINT': '발행',
      'BURN': '소각',
      'SIGNUP_BONUS': '가입보너스',
      'DAILY_CHECKIN': '출석체크',
      'CERTIFICATE': '증명서',
      'TRANSFER': '전송',
      'PERFECT_ATTENDANCE': '개근보너스',
      'PROFILE_COMPLETE': '프로필완성',
      'PHOTO_UPLOAD': '사진등록'
    };
    return labels[type] || type;
  };

  // 거래 유형 색상
  const getTxTypeColor = (type, amount) => {
    if (amount > 0) return 'text-emerald-600 bg-emerald-50';
    if (amount < 0) return 'text-rose-600 bg-rose-50';
    return 'text-gray-600 bg-gray-50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* 헤더 */}
      <div className="pt-2">
        <h1 className="text-2xl font-bold text-gray-900">크레딧 관리</h1>
        <p className="text-gray-500 mt-1">WPT 토큰 이코노미 대시보드</p>
      </div>

      {/* KPI 통계 카드 */}
      {tokenStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">총 발행량</p>
            <p className="text-2xl font-bold text-gray-900">{tokenStats.total_supply?.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">WPT</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">홀더 수</p>
            <p className="text-2xl font-bold text-gray-900">{tokenStats.holder_count?.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">명</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">오늘 발행</p>
            <p className="text-2xl font-bold text-emerald-600">+{tokenStats.today_minted?.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">WPT</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">오늘 사용</p>
            <p className="text-2xl font-bold text-rose-600">-{tokenStats.today_burned?.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">WPT</p>
          </div>
        </div>
      )}

      {/* 토큰 정보 카드 */}
      {tokenInfo && (
        <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
          {/* 배경 패턴 */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-1/2 -translate-x-1/2"></div>
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg">
                W
              </div>
              <div>
                <p className="font-bold text-white text-lg">{tokenInfo.name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/60">{tokenInfo.symbol}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/30 text-purple-200 border border-purple-400/30">
                    {tokenInfo.network === 'amoy' ? 'Polygon Amoy' : 'Polygon'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
              <span className="text-xs text-white/50">컨트랙트</span>
              <a
                href={`https://amoy.polygonscan.com/address/${tokenInfo.contract_address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-blue-300 hover:text-blue-200 truncate flex-1"
              >
                {tokenInfo.contract_address?.slice(0, 20)}...
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(tokenInfo.contract_address);
                  alert('복사되었습니다');
                }}
                className="text-xs px-2 py-1 rounded bg-white/10 text-white/70 hover:bg-white/20"
              >
                복사
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 탭 네비게이션 */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        <button
          onClick={() => setActiveTab('holders')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'holders'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          홀더 목록
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'history'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          거래 내역
        </button>
      </div>

      {/* 홀더 목록 탭 */}
      {activeTab === 'holders' && (
        <>
          {/* 검색 */}
          <div className="relative">
            <input
              type="text"
              placeholder="이름 또는 전화번호 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>

          {/* 근무자 목록 */}
          <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
            {filteredWorkers.length > 0 ? (
              filteredWorkers.map((worker, idx) => (
                <div
                  key={worker.id}
                  className="flex items-center gap-3 py-3.5 px-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  style={{ borderBottom: idx < filteredWorkers.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                  onClick={() => handleSelectWorker(worker)}
                >
                  {worker.face_photo_file_id ? (
                    <img
                      src={workersAPI.getPhotoUrlFromPath(worker.face_photo_file_id)}
                      alt={worker.name}
                      className="w-11 h-11 rounded-full object-cover flex-shrink-0 ring-2 ring-gray-100"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className={`w-11 h-11 rounded-full items-center justify-center flex-shrink-0 bg-gray-100 ${worker.face_photo_file_id ? 'hidden' : 'flex'}`}
                  >
                    <span className="text-lg text-gray-400">👤</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{worker.name}</p>
                    <p className="text-xs text-gray-500">{worker.phone}</p>
                    {/* 배지 표시 */}
                    {worker.top_badges && worker.top_badges.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        {worker.top_badges.slice(0, 3).map((badge, i) => (
                          <span key={i} className="text-sm" title={badge.title}>{badge.icon}</span>
                        ))}
                        {worker.badge_count > 3 && (
                          <span className="text-xs text-gray-400">+{worker.badge_count - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-2xl font-bold text-blue-600">
                      {worker.tokens ?? '-'}
                    </p>
                    <p className="text-xs text-gray-400">WPT</p>
                    {worker.badge_count > 0 && (
                      <p className="text-xs text-purple-500">🏅 {worker.badge_count}</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400">
                  {search ? '검색 결과가 없습니다' : '등록된 근무자가 없습니다'}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* 거래 내역 탭 */}
      {activeTab === 'history' && (
        <>
          {/* 필터 */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { value: null, label: '전체' },
              { value: 'MINT', label: '발행' },
              { value: 'SIGNUP_BONUS', label: '가입보너스' },
              { value: 'DAILY_CHECKIN', label: '출석체크' },
              { value: 'CERTIFICATE', label: '증명서' },
            ].map((filter) => (
              <button
                key={filter.value || 'all'}
                onClick={() => setTxTypeFilter(filter.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  txTypeFilter === filter.value
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* 거래 내역 목록 */}
          <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
              </div>
            ) : txHistory.length > 0 ? (
              txHistory.map((tx, idx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 py-3 px-4"
                  style={{ borderBottom: idx < txHistory.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    tx.amount > 0 ? 'bg-emerald-100' : 'bg-rose-100'
                  }`}>
                    <span className={`text-lg ${tx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {tx.amount > 0 ? '↓' : '↑'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm">{tx.worker_name || '알 수 없음'}</p>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${getTxTypeColor(tx.tx_type, tx.amount)}`}>
                        {getTxTypeLabel(tx.tx_type)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{tx.reason}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold ${tx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </p>
                    <p className="text-xs text-gray-400">
                      {tx.created_at ? new Date(tx.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400">거래 내역이 없습니다</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* 크레딧 발행 모달 */}
      {selectedWorker && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center sm:justify-center z-50">
          <div className="bg-white w-full sm:w-[420px] sm:max-w-[90vw] rounded-t-3xl sm:rounded-2xl p-5 space-y-4 animate-slide-up max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">크레딧 발행</h2>
              <button
                onClick={() => setSelectedWorker(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
              >
                <span className="text-xl text-gray-500">×</span>
              </button>
            </div>

            {/* 근무자 정보 */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              {selectedWorker.face_photo_file_id ? (
                <img
                  src={workersAPI.getPhotoUrlFromPath(selectedWorker.face_photo_file_id)}
                  alt={selectedWorker.name}
                  className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className={`w-12 h-12 bg-gray-200 rounded-full items-center justify-center flex-shrink-0 ${selectedWorker.face_photo_file_id ? 'hidden' : 'flex'}`}
              >
                <span className="text-lg">👤</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900">{selectedWorker.name}</h3>
                <p className="text-gray-500 text-sm">{selectedWorker.phone}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">현재 잔액</p>
                {workerBalance ? (
                  <p className="text-xl font-bold text-blue-600">
                    {workerBalance.balance?.toLocaleString()}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">로딩중...</p>
                )}
              </div>
            </div>

            {/* 발행 폼 */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  발행 수량
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMintAmount(Math.max(1, mintAmount - 1))}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={mintAmount}
                    onChange={(e) => setMintAmount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 text-center text-2xl font-bold py-2 rounded-xl bg-gray-50 text-gray-900 border-0"
                    min="1"
                  />
                  <button
                    onClick={() => setMintAmount(mintAmount + 1)}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    +
                  </button>
                </div>
                <div className="flex gap-2 mt-2">
                  {[1, 3, 5, 10].map((n) => (
                    <button
                      key={n}
                      onClick={() => setMintAmount(n)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                        mintAmount === n
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      +{n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  발행 사유 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={mintReason}
                  onChange={(e) => setMintReason(e.target.value)}
                  placeholder="예: 신규 가입 보너스, 이벤트 참여 보상"
                  className="input"
                />
              </div>
            </div>

            {/* 발행 버튼 */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setSelectedWorker(null)}
                className="flex-1 py-3 rounded-xl font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                취소
              </button>
              <button
                onClick={handleMint}
                disabled={minting || !mintReason.trim()}
                className="flex-1 py-3 rounded-xl font-semibold text-white disabled:opacity-50 bg-blue-600 hover:bg-blue-700"
              >
                {minting ? '발행 중...' : `${mintAmount} WPT 발행`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
