import { useState, useEffect } from 'react';
import { adminAPI, workersAPI, bigdataAPI } from '../../api/client';

export default function AdminWorkers() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 지역 관련 상태
  const [regions, setRegions] = useState([]);
  const [sidoList, setSidoList] = useState([]);
  const [sigunguList, setSigunguList] = useState([]);
  const [selectedSido, setSelectedSido] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    loadWorkers();
    loadRegions();
  }, []);

  const loadRegions = async () => {
    try {
      const { data } = await bigdataAPI.getRegions();
      const regionsData = data.regions || [];
      setRegions(regionsData);
      const uniqueSido = [...new Set(regionsData.map(r => r.sido))];
      setSidoList(uniqueSido);
    } catch (error) {
      console.error('Failed to load regions:', error);
    }
  };

  // 시도 선택 시 시군구 필터링
  useEffect(() => {
    if (selectedSido) {
      const filtered = regions.filter(r => r.sido === selectedSido);
      setSigunguList(filtered);
    } else {
      setSigunguList([]);
    }
  }, [selectedSido, regions]);

  const loadWorkers = async () => {
    try {
      const { data } = await adminAPI.getAllWorkers();
      setWorkers(data.workers || data || []);
    } catch (error) {
      console.error('Failed to load workers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWorker = (worker) => {
    setSelectedWorker(worker);
    setEditMode(false);
    setEditData({});
    setShowDeleteConfirm(false);
  };

  const handleCloseModal = () => {
    setSelectedWorker(null);
    setEditMode(false);
    setEditData({});
    setShowDeleteConfirm(false);
  };

  const handleStartEdit = () => {
    // 기존 region_id로 sido 설정
    if (selectedWorker.region_id) {
      const region = regions.find(r => r.id === selectedWorker.region_id);
      if (region) {
        setSelectedSido(region.sido);
      }
    } else {
      setSelectedSido('');
    }

    setEditData({
      name: selectedWorker.name || '',
      phone: selectedWorker.phone || '',
      birth_date: selectedWorker.birth_date || '',
      residence: selectedWorker.residence || '',
      region_id: selectedWorker.region_id || '',
      bank_name: selectedWorker.bank_name || '',
      bank_account: selectedWorker.bank_account || '',
      driver_license: selectedWorker.driver_license || false,
      security_cert: selectedWorker.security_cert || false,
    });
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      // 거주지역 텍스트 생성
      let saveData = { ...editData };
      if (editData.region_id) {
        const region = regions.find(r => r.id === parseInt(editData.region_id));
        if (region) {
          saveData.residence = `${region.sido} ${region.sigungu}`;
        }
        saveData.region_id = parseInt(editData.region_id);
      }

      await workersAPI.update(selectedWorker.id, saveData);
      // 목록 새로고침
      await loadWorkers();
      // 선택된 근무자 정보도 업데이트
      const { data } = await workersAPI.get(selectedWorker.id);
      setSelectedWorker(data);
      setEditMode(false);
      setSelectedSido('');
      alert('저장되었습니다');
    } catch (error) {
      alert(error.response?.data?.detail || '저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await workersAPI.delete(selectedWorker.id);
      handleCloseModal();
      await loadWorkers();
      alert('삭제되었습니다');
    } catch (error) {
      alert(error.response?.data?.detail || '삭제에 실패했습니다');
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
        <h1 className="text-2xl font-bold text-gray-900">회원 관리</h1>
        <p className="text-gray-500 mt-1">총 {workers.length}명</p>
      </div>

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
                {worker.email && (
                  <p className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>ID: {worker.email}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{worker.residence || '-'}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10">
            <p style={{ color: 'var(--color-text-disabled)' }}>
              {search ? '검색 결과가 없습니다' : '등록된 회원이 없습니다'}
            </p>
          </div>
        )}
      </div>

      {/* 상세 모달 */}
      {selectedWorker && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center sm:justify-center z-50">
          <div className="bg-white w-full sm:w-[420px] sm:max-w-[90vw] rounded-t-3xl sm:rounded-2xl p-5 space-y-3 animate-slide-up max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">{editMode ? '회원정보수정' : '회원 정보'}</h2>
              <button
                onClick={handleCloseModal}
                className="w-8 h-8 flex items-center justify-center rounded-full"
                style={{ backgroundColor: 'var(--color-bg)' }}
              >
                <span className="text-xl" style={{ color: 'var(--color-text-secondary)' }}>×</span>
              </button>
            </div>

            {/* 프로필 영역 */}
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              {selectedWorker.face_photo_file_id ? (
                <img
                  src={workersAPI.getPhotoUrlFromPath(selectedWorker.face_photo_file_id)}
                  alt={selectedWorker.name}
                  className="w-12 h-12 rounded-full object-cover cursor-pointer flex-shrink-0"
                  onClick={() => window.open(workersAPI.getPhotoUrlFromPath(selectedWorker.face_photo_file_id), '_blank')}
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
                <span className="text-xl">👤</span>
              </div>
              <div className="flex-1 min-w-0">
                {editMode ? (
                  <input
                    type="text"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="input text-base font-semibold py-1.5"
                    placeholder="이름"
                  />
                ) : (
                  <>
                    <h3 className="text-base font-semibold">{selectedWorker.name}</h3>
                    <p className="text-sm text-gray-500">{selectedWorker.phone}</p>
                    {selectedWorker.email && (
                      <p className="text-xs text-gray-400">ID: {selectedWorker.email}</p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* 정보 영역 */}
            {editMode ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-sub)' }}>전화번호</label>
                  <input
                    type="text"
                    value={editData.phone}
                    onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                    className="input py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-sub)' }}>생년월일</label>
                  <input
                    type="date"
                    value={editData.birth_date}
                    onChange={(e) => setEditData({ ...editData, birth_date: e.target.value })}
                    className="input py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-sub)' }}>거주지역</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={selectedSido}
                      onChange={(e) => {
                        setSelectedSido(e.target.value);
                        setEditData({ ...editData, region_id: '' });
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">시/도</option>
                      {sidoList.map((sido) => (
                        <option key={sido} value={sido}>{sido}</option>
                      ))}
                    </select>
                    <select
                      value={editData.region_id}
                      onChange={(e) => setEditData({ ...editData, region_id: e.target.value })}
                      disabled={!selectedSido}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                    >
                      <option value="">시/군/구</option>
                      {sigunguList.map((region) => (
                        <option key={region.id} value={region.id}>{region.sigungu}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-sub)' }}>은행</label>
                    <input
                      type="text"
                      value={editData.bank_name}
                      onChange={(e) => setEditData({ ...editData, bank_name: e.target.value })}
                      className="input py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-sub)' }}>계좌번호</label>
                    <input
                      type="text"
                      value={editData.bank_account}
                      onChange={(e) => setEditData({ ...editData, bank_account: e.target.value })}
                      className="input py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 py-2">
                  <input
                    type="checkbox"
                    id="driver_license"
                    checked={editData.driver_license}
                    onChange={(e) => setEditData({ ...editData, driver_license: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="driver_license" className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>운전면허 보유</label>
                </div>
                <div className="flex items-center gap-2 py-2">
                  <input
                    type="checkbox"
                    id="security_cert"
                    checked={editData.security_cert}
                    onChange={(e) => setEditData({ ...editData, security_cert: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="security_cert" className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>경호이수증 보유</label>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between py-1.5">
                  <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>생년월일</span>
                  <span className="text-sm font-medium">{selectedWorker.birth_date || '-'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>거주지역</span>
                  <span className="text-sm font-medium">{selectedWorker.residence || '-'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>은행</span>
                  <span className="text-sm font-medium">{selectedWorker.bank_name || '-'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>계좌번호</span>
                  <span className="text-sm font-medium">{selectedWorker.bank_account || '-'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>운전면허</span>
                  <span className="text-sm font-medium">{selectedWorker.driver_license ? 'O' : 'X'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>경호이수증</span>
                  <span className="text-sm font-medium">{selectedWorker.security_cert ? 'O' : 'X'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>등록일</span>
                  <span className="text-sm font-medium">{selectedWorker.created_at?.split(' ')[0] || '-'}</span>
                </div>
              </div>
            )}

            {/* 삭제 확인 */}
            {showDeleteConfirm && (
              <div className="rounded-xl p-4" style={{ backgroundColor: '#FEF2F2' }}>
                <p className="text-sm text-red-600 font-medium mb-3">정말 이 근무자를 삭제하시겠습니까?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 rounded-lg text-xs font-medium"
                    style={{ backgroundColor: 'white', color: 'var(--color-text-secondary)' }}
                  >
                    취소
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 py-2 rounded-lg text-xs font-medium bg-red-500 text-white"
                  >
                    삭제
                  </button>
                </div>
              </div>
            )}

            {/* 버튼 영역 */}
            {editMode ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditMode(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-medium"
                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
                >
                  취소
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-xs font-medium text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' }}
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="py-2.5 px-4 rounded-xl text-xs font-medium text-red-500"
                  style={{ backgroundColor: '#FEF2F2' }}
                >
                  삭제
                </button>
                <button
                  onClick={handleStartEdit}
                  className="flex-1 py-2.5 rounded-xl text-xs font-medium"
                  style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
                >
                  수정
                </button>
                <button
                  onClick={handleCloseModal}
                  className="flex-1 py-2.5 rounded-xl text-xs font-medium text-white"
                  style={{ background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' }}
                >
                  닫기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
