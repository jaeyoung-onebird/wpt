import { useState, useEffect } from 'react';
import { adminAPI, creditsAPI, workersAPI } from '../../api/client';

export default function AdminCredits() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [workerBalance, setWorkerBalance] = useState(null);
  const [mintAmount, setMintAmount] = useState(1);
  const [mintReason, setMintReason] = useState('');
  const [minting, setMinting] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [workersRes, tokenInfoRes] = await Promise.all([
        adminAPI.getWorkers(),
        creditsAPI.getTokenInfo()
      ]);

      const workersList = workersRes.data.workers || [];
      setWorkers(workersList);
      setTokenInfo(tokenInfoRes.data);
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
      const { data } = await creditsAPI.mint(selectedWorker.id, mintAmount, mintReason);
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

      // 토큰 정보(총 발행량) 새로고침
      const tokenInfoRes = await creditsAPI.getTokenInfo();
      setTokenInfo(tokenInfoRes.data);

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
        <h1 className="text-2xl font-bold text-gray-900">크레딧 관리</h1>
        <p className="text-gray-500 mt-1">WPT 토큰 발행 및 관리</p>
      </div>

      {/* 토큰 정보 */}
      {tokenInfo && (
        <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}>
              W
            </div>
            <div>
              <p className="font-bold text-white">{tokenInfo.name}</p>
              <p className="text-xs text-white/60">{tokenInfo.symbol}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-white/60">총 발행량</p>
              <p className="font-semibold text-white">{tokenInfo.total_supply?.toLocaleString()} WPT</p>
            </div>
            <div>
              <p className="text-white/60">네트워크</p>
              <p className="font-semibold text-white">{tokenInfo.network === 'amoy' ? 'Polygon Amoy' : 'Polygon'}</p>
            </div>
            <div className="col-span-2 mt-2 pt-2 border-t border-white/10">
              <p className="text-white/60 text-xs">컨트랙트</p>
              <a
                href={`https://amoy.polygonscan.com/address/${tokenInfo.contract_address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono break-all text-blue-300 hover:text-blue-200"
              >
                {tokenInfo.contract_address} &rarr;
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 검색 */}
      <div className="relative">
        <input
          type="text"
          placeholder="이름 또는 전화번호 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-10"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
      </div>

      {/* 근무자 목록 */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
        {filteredWorkers.length > 0 ? (
          filteredWorkers.map((worker, idx) => (
            <div
              key={worker.id}
              className="flex items-center gap-3 py-3.5 px-4 cursor-pointer hover:bg-gray-50 transition-colors"
              style={{ borderBottom: idx < filteredWorkers.length - 1 ? '1px solid var(--color-border)' : 'none' }}
              onClick={() => handleSelectWorker(worker)}
            >
              {worker.face_photo_file_id ? (
                <img
                  src={workersAPI.getPhotoUrlFromPath(worker.face_photo_file_id)}
                  alt={worker.name}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className={`w-10 h-10 rounded-full items-center justify-center flex-shrink-0 ${worker.face_photo_file_id ? 'hidden' : 'flex'}`}
                style={{ backgroundColor: 'var(--color-bg)' }}
              >
                <span className="text-lg">👤</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium" style={{ color: 'var(--color-text-title)' }}>{worker.name}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>{worker.phone}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>크레딧</p>
                <p className="font-bold" style={{ color: 'var(--color-primary)' }}>
                  {worker.tokens ?? '-'}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10">
            <p style={{ color: 'var(--color-text-disabled)' }}>
              {search ? '검색 결과가 없습니다' : '등록된 근무자가 없습니다'}
            </p>
          </div>
        )}
      </div>

      {/* 크레딧 발행 모달 */}
      {selectedWorker && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center sm:justify-center z-50">
          <div className="bg-white w-full sm:w-[420px] sm:max-w-[90vw] rounded-t-3xl sm:rounded-2xl p-5 space-y-3 animate-slide-up max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">크레딧 발행</h2>
              <button
                onClick={() => setSelectedWorker(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full"
                style={{ backgroundColor: 'var(--color-bg)' }}
              >
                <span className="text-xl" style={{ color: 'var(--color-text-secondary)' }}>×</span>
              </button>
            </div>

            {/* 근무자 정보 */}
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              {selectedWorker.face_photo_file_id ? (
                <img
                  src={workersAPI.getPhotoUrlFromPath(selectedWorker.face_photo_file_id)}
                  alt={selectedWorker.name}
                  className="w-11 h-11 rounded-full object-cover flex-shrink-0"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className={`w-11 h-11 bg-gray-200 rounded-full items-center justify-center flex-shrink-0 ${selectedWorker.face_photo_file_id ? 'hidden' : 'flex'}`}
              >
                <span className="text-lg">👤</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold">{selectedWorker.name}</h3>
                <p className="text-gray-500 text-sm">{selectedWorker.phone}</p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>현재 잔액</p>
                {workerBalance ? (
                  <p className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
                    {workerBalance.balance?.toLocaleString()}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">로딩중...</p>
                )}
              </div>
            </div>

            {/* 발행 폼 */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-sub)' }}>
                  발행 수량
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMintAmount(Math.max(1, mintAmount - 1))}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-base font-bold"
                    style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={mintAmount}
                    onChange={(e) => setMintAmount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 text-center text-xl font-bold py-2 rounded-xl"
                    style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-title)' }}
                    min="1"
                  />
                  <button
                    onClick={() => setMintAmount(mintAmount + 1)}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-base font-bold"
                    style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
                  >
                    +
                  </button>
                </div>
                <div className="flex gap-1.5 mt-1.5">
                  {[1, 3, 5, 10].map((n) => (
                    <button
                      key={n}
                      onClick={() => setMintAmount(n)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium ${mintAmount === n ? 'text-white' : ''}`}
                      style={{
                        backgroundColor: mintAmount === n ? 'var(--color-primary)' : 'var(--color-bg)',
                        color: mintAmount === n ? 'white' : 'var(--color-text-secondary)'
                      }}
                    >
                      +{n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-sub)' }}>
                  발행 사유 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={mintReason}
                  onChange={(e) => setMintReason(e.target.value)}
                  placeholder="예: 신규 가입 보너스, 이벤트 참여 보상"
                  className="input py-2 text-sm"
                />
              </div>
            </div>

            {/* 발행 버튼 */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setSelectedWorker(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium"
                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
              >
                취소
              </button>
              <button
                onClick={handleMint}
                disabled={minting || !mintReason.trim()}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' }}
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
