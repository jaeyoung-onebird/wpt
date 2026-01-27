import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI, eventsAPI } from '../../api/client';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingByEvent, setPendingByEvent] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const dashboardRes = await adminAPI.dashboard();
      setStats(dashboardRes.data.stats);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingApplications = async () => {
    setLoadingPending(true);
    try {
      const { data } = await eventsAPI.getList();
      const events = data.events || [];

      // 각 행사별 대기중 지원자 로드
      const pendingData = await Promise.all(
        events.filter(e => e.status === 'OPEN').map(async (event) => {
          try {
            const { data: appData } = await adminAPI.getEventApplications(event.id);
            const pending = (appData.applications || []).filter(a => a.status === 'PENDING');
            return { event, pending };
          } catch {
            return { event, pending: [] };
          }
        })
      );

      // 대기중인 지원자가 있는 행사만 필터링
      setPendingByEvent(pendingData.filter(p => p.pending.length > 0));
    } catch (error) {
      console.error('Failed to load pending applications:', error);
    } finally {
      setLoadingPending(false);
    }
  };

  const handlePendingClick = () => {
    setShowPendingModal(true);
    loadPendingApplications();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 animate-fade-in">
      {/* 헤더 */}
      <div className="pt-1">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-title)' }}>관리자 대시보드</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-sub)' }}>오늘의 현황을 확인하세요</p>
      </div>

      {/* 핵심 지표 2개만 */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="rounded-xl p-4 text-center cursor-pointer hover:shadow-md transition-shadow"
          style={{ backgroundColor: 'var(--color-bg-card)' }}
          onClick={handlePendingClick}
        >
          <p className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>
            {stats?.pending_applications || 0}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-sub)' }}>대기중 지원</p>
        </div>
        <Link to="/admin/attendance" className="rounded-xl p-4 text-center hover:shadow-md transition-shadow" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          <p className="text-3xl font-bold" style={{ color: 'var(--color-success)' }}>
            {stats?.checked_in_now || 0}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-sub)' }}>현재 출근</p>
        </Link>
      </div>

      {/* Primary CTA - 행사 등록 */}
      <Link to="/admin/events/new" className="block">
        <button className="btn-cta">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          새 행사 등록
        </button>
      </Link>

      {/* 퀵 메뉴 - 텍스트 기반 */}
      <div>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-sub)' }}>관리 메뉴</p>
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          <Link to="/admin/events" className="flex items-center gap-3 py-3.5 px-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
              <span>📋</span>
            </div>
            <div className="flex-1">
              <p className="font-medium" style={{ color: 'var(--color-text-title)' }}>행사 관리</p>
              <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>모집중 {stats?.open_events || 0}건</p>
            </div>
            <span style={{ color: 'var(--color-text-sub)' }}>&rarr;</span>
          </Link>

          <Link to="/admin/workers" className="flex items-center gap-3 py-3.5 px-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
              <span>👥</span>
            </div>
            <div className="flex-1">
              <p className="font-medium" style={{ color: 'var(--color-text-title)' }}>회원 관리</p>
              <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>등록 {stats?.total_workers || 0}명</p>
            </div>
            <span style={{ color: 'var(--color-text-sub)' }}>&rarr;</span>
          </Link>

          <Link to="/admin/attendance" className="flex items-center gap-3 py-3.5 px-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
              <span>📊</span>
            </div>
            <div className="flex-1">
              <p className="font-medium" style={{ color: 'var(--color-text-title)' }}>출석 관리</p>
              <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>출퇴근 기록 조회</p>
            </div>
            <span style={{ color: 'var(--color-text-sub)' }}>&rarr;</span>
          </Link>

          <Link to="/blockchain" className="flex items-center gap-3 py-3.5 px-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
              <span>⛓️</span>
            </div>
            <div className="flex-1">
              <p className="font-medium" style={{ color: 'var(--color-text-title)' }}>블록체인</p>
              <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>기록 조회 및 검증</p>
            </div>
            <span style={{ color: 'var(--color-text-sub)' }}>&rarr;</span>
          </Link>

          <Link to="/admin/credits" className="flex items-center gap-3 py-3.5 px-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
              <span>W</span>
            </div>
            <div className="flex-1">
              <p className="font-medium" style={{ color: 'var(--color-text-title)' }}>크레딧 관리</p>
              <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>WPT 토큰 발행</p>
            </div>
            <span style={{ color: 'var(--color-text-sub)' }}>&rarr;</span>
          </Link>

          <Link to="/admin/analytics" className="flex items-center gap-3 py-3.5 px-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
              <span>📈</span>
            </div>
            <div className="flex-1">
              <p className="font-medium" style={{ color: 'var(--color-text-title)' }}>분석 리포트</p>
              <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>WorkScore 및 매출 분석</p>
            </div>
            <span style={{ color: 'var(--color-text-sub)' }}>&rarr;</span>
          </Link>

          <Link to="/admin/bigdata" className="flex items-center gap-3 py-3.5 px-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
              <span>🗄️</span>
            </div>
            <div className="flex-1">
              <p className="font-medium" style={{ color: 'var(--color-text-title)' }}>빅데이터 관리</p>
              <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>마스터 데이터 및 배치 작업</p>
            </div>
            <span style={{ color: 'var(--color-text-sub)' }}>&rarr;</span>
          </Link>

          <Link to="/admin/settings" className="flex items-center gap-3 py-3.5 px-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
              <span>⚙️</span>
            </div>
            <div className="flex-1">
              <p className="font-medium" style={{ color: 'var(--color-text-title)' }}>설정</p>
              <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>관리자 권한 설정</p>
            </div>
            <span style={{ color: 'var(--color-text-sub)' }}>&rarr;</span>
          </Link>
        </div>
      </div>

      {/* 대기중 지원 모달 */}
      {showPendingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center sm:justify-center z-50">
          <div className="bg-white w-full sm:w-[420px] sm:max-w-[90vw] rounded-t-3xl sm:rounded-2xl max-h-[85vh] overflow-hidden animate-slide-up">
            {/* 헤더 */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-title)' }}>대기중 지원</h2>
                <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>행사별 대기중인 지원자</p>
              </div>
              <button
                onClick={() => setShowPendingModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full"
                style={{ backgroundColor: 'var(--color-bg)' }}
              >
                <span className="text-xl" style={{ color: 'var(--color-text-secondary)' }}>×</span>
              </button>
            </div>

            {/* 내용 */}
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 110px)' }}>
              {loadingPending ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
                </div>
              ) : pendingByEvent.length > 0 ? (
                <div className="space-y-3">
                  {pendingByEvent.map(({ event, pending }) => (
                    <div key={event.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
                      {/* 행사 헤더 */}
                      <Link
                        to={`/admin/events/${event.id}`}
                        className="block px-3 py-2.5 border-b"
                        style={{ borderColor: 'var(--color-border)', background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-white text-sm">{event.title}</p>
                            <p className="text-xs text-white/70">{event.work_date || event.event_date} · {event.location}</p>
                          </div>
                          <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs text-white">
                            {pending.length}명
                          </span>
                        </div>
                      </Link>
                      {/* 대기중 지원자 목록 */}
                      <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                        {pending.map((app) => (
                          <div key={app.id} className="flex items-center gap-2.5 px-3 py-2.5 bg-white">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0" style={{ backgroundColor: 'var(--color-bg)' }}>
                              👤
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm" style={{ color: 'var(--color-text-title)' }}>{app.worker_name || '이름없음'}</p>
                              <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>{app.worker_phone || '-'}</p>
                            </div>
                            <span className="chip-pending text-xs">대기</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>대기중인 지원이 없습니다</p>
                </div>
              )}
            </div>

            {/* 하단 버튼 */}
            <div className="p-4 border-t border-gray-100">
              <button
                onClick={() => setShowPendingModal(false)}
                className="w-full py-2.5 rounded-xl text-xs font-medium"
                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
