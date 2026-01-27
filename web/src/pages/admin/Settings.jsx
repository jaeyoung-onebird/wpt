import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../../api/client';

export default function AdminSettings() {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    loadWorkers();
  }, []);

  const loadWorkers = async () => {
    try {
      const { data } = await adminAPI.getAllWorkers();
      setWorkers(data.workers || []);
    } catch (error) {
      console.error('Failed to load workers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdmin = async (worker) => {
    const newStatus = !worker.is_admin;
    const action = newStatus ? '관리자로 임명' : '관리자 해제';

    if (!confirm(`${worker.name}님을 ${action}하시겠습니까?`)) return;

    setSaving(worker.id);
    try {
      await adminAPI.setAdmin(worker.id, newStatus);
      setWorkers(workers.map(w =>
        w.id === worker.id ? { ...w, is_admin: newStatus } : w
      ));
      alert(`${worker.name}님이 ${action}되었습니다`);
    } catch (error) {
      alert(error.response?.data?.detail || '변경에 실패했습니다');
    } finally {
      setSaving(null);
    }
  };

  const filteredWorkers = workers.filter(w =>
    w.name?.includes(searchTerm) ||
    w.email?.includes(searchTerm) ||
    w.phone?.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* 헤더 */}
      <div className="pt-2 flex items-center gap-4">
        <button onClick={() => navigate('/admin')} className="text-gray-600">
          <span className="text-xl">←</span>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
      </div>

      {/* 관리자 설정 */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">관리자 설정</h2>
        <p className="text-sm text-gray-500 mb-4">
          회원 중 관리자 권한을 부여하거나 해제할 수 있습니다
        </p>

        {/* 검색 */}
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="이름, 이메일, 전화번호 검색..."
          className="input w-full mb-4"
        />

        {/* 회원 목록 */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredWorkers.length > 0 ? (
            filteredWorkers.map((worker) => (
              <div
                key={worker.id}
                className={`flex items-center justify-between py-3 px-4 rounded-xl ${
                  worker.is_admin ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{worker.name}</span>
                    {worker.is_admin && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                        관리자
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {worker.email || worker.phone || '-'}
                  </div>
                </div>
                <button
                  onClick={() => handleToggleAdmin(worker)}
                  disabled={saving === worker.id}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    worker.is_admin
                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {saving === worker.id ? '...' : (worker.is_admin ? '해제' : '임명')}
                </button>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-400 py-4">
              {searchTerm ? '검색 결과가 없습니다' : '등록된 회원이 없습니다'}
            </p>
          )}
        </div>
      </div>

      {/* 시스템 정보 */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">시스템 정보</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">버전</span>
            <span className="font-medium">2.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">블록체인</span>
            <span className="font-medium">Polygon Amoy</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">전체 회원</span>
            <span className="font-medium">{workers.length}명</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">관리자</span>
            <span className="font-medium">{workers.filter(w => w.is_admin).length}명</span>
          </div>
        </div>
      </div>
    </div>
  );
}
