import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { applicationsAPI } from '../api/client';
import { formatPay, formatDateShort, calculateNetPay } from '../utils/format';

export default function Applications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [canceling, setCanceling] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      const { data } = await applicationsAPI.getMyList();
      setApplications(data.applications || []);
    } catch (error) {
      console.error('Failed to load applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (e, appId) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('지원을 취소하시겠습니까?')) return;

    setCanceling(appId);
    try {
      await applicationsAPI.cancel(appId);
      alert('지원이 취소되었습니다');
      loadApplications();
    } catch (error) {
      alert(error.response?.data?.detail || '취소에 실패했습니다');
    } finally {
      setCanceling(null);
    }
  };

  const filteredApplications = applications.filter((app) => {
    if (filter === 'all') return true;
    return app.status === filter;
  });

  const getStatusChip = (status) => {
    const chips = {
      PENDING: <span className="chip-pending">심사중</span>,
      CONFIRMED: <span className="chip-confirmed">확정</span>,
      REJECTED: <span className="chip-rejected">불합격</span>,
      WAITLIST: <span className="chip-waitlist">대기</span>,
    };
    return chips[status] || null;
  };

  // formatDateShort과 formatPay는 utils/format.js에서 import

  const filters = [
    { key: 'all', label: '전체' },
    { key: 'PENDING', label: '심사중' },
    { key: 'CONFIRMED', label: '확정' },
    { key: 'WAITLIST', label: '대기' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* 헤더 - 토스 스타일 */}
      <div className="pt-2">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-title)' }}>지원 현황</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-sub)' }}>
          {applications.length > 0 ? `총 ${applications.length}건` : ''}
        </p>
      </div>

      {/* 필터 칩 - 토스 스타일 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all"
            style={{
              backgroundColor: filter === key ? 'var(--color-primary)' : 'var(--color-bg)',
              color: filter === key ? 'white' : 'var(--color-text-secondary)'
            }}
          >
            {label}
            {key !== 'all' && (
              <span className="ml-1 opacity-70">
                {applications.filter(a => a.status === key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 지원 목록 - 토스 스타일 */}
      {filteredApplications.length > 0 ? (
        <div className="space-y-2">
          {filteredApplications.map((app) => (
            <div key={app.id} className="card card-hover">
              <Link to={`/events/${app.event_id}`}>
                {/* 상단: 급여 + 상태칩 */}
                <div className="flex justify-between items-start mb-2">
                  {app.pay_amount ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
                        {formatPay(calculateNetPay(app.pay_amount))}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-text-sub)' }}>실수령</span>
                    </div>
                  ) : (
                    <span className="text-lg font-bold" style={{ color: 'var(--color-text-title)' }}>-</span>
                  )}
                  {getStatusChip(app.status)}
                </div>

                {/* 행사명 */}
                <h3 className="font-semibold mb-2 line-clamp-1" style={{ color: 'var(--color-text-title)' }}>
                  {app.event_title || '행사'}
                </h3>

                {/* 날짜 정보 */}
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-sub)' }}>
                  <span>{formatDateShort(app.event_date)}</span>
                  <span style={{ color: 'var(--color-border)' }}>|</span>
                  <span>지원 {formatDateShort(app.applied_at?.split(' ')[0])}</span>
                </div>

                {/* 거부 사유 */}
                {app.status === 'REJECTED' && app.rejection_reason && (
                  <div className="mt-3 p-3 rounded-xl text-sm" style={{ backgroundColor: 'rgba(240, 68, 82, 0.08)', color: 'var(--color-error)' }}>
                    {app.rejection_reason}
                  </div>
                )}
              </Link>

              {/* 취소 버튼 - PENDING 상태만 */}
              {app.status === 'PENDING' && (
                <button
                  onClick={(e) => handleCancel(e, app.id)}
                  disabled={canceling === app.id}
                  className="mt-3 w-full py-2.5 text-sm font-medium rounded-xl transition-all active:scale-[0.98]"
                  style={{ color: 'var(--color-error)', backgroundColor: 'var(--color-bg)' }}
                >
                  {canceling === app.id ? '취소 중...' : '지원 취소'}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: 'var(--color-bg)' }}>
            📝
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text-title)' }}>
            {filter === 'all' ? '아직 지원 내역이 없어요' : '해당하는 지원이 없어요'}
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-sub)' }}>
            {filter === 'all' ? (
              <>마음에 드는 행사에<br />지원해보세요</>
            ) : (
              '다른 필터를 선택해보세요'
            )}
          </p>
          {filter === 'all' && (
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              행사 둘러보기
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
