import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { eventsAPI, applicationsAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, worker } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [myApplication, setMyApplication] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadEvent();
  }, [id]);

  const loadEvent = async () => {
    try {
      const { data } = await eventsAPI.get(id);
      setEvent(data);

      // 이미 지원했는지 확인
      if (worker) {
        const { data: apps } = await applicationsAPI.getMyList();
        const existing = apps.applications?.find(a => a.event_id === parseInt(id));
        setMyApplication(existing);
      }
    } catch (error) {
      console.error('Failed to load event:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!worker) {
      navigate('/login');
      return;
    }

    setApplying(true);
    try {
      // 일정 충돌 체크
      const { data: conflictData } = await applicationsAPI.checkConflict(parseInt(id));

      if (conflictData.has_conflict) {
        const conflicts = conflictData.conflicting_events;
        const conflictMessage = conflicts.map(c => {
          const date = c.event_date ? new Date(c.event_date).toLocaleDateString() : '날짜 미정';
          const time = c.start_time && c.end_time ? ` ${c.start_time} ~ ${c.end_time}` : '';
          return `• ${c.title} (${date}${time})`;
        }).join('\n');

        const confirmed = confirm(
          `⚠️ 일정이 겹치는 행사가 있습니다:\n\n${conflictMessage}\n\n그래도 지원하시겠습니까?`
        );

        if (!confirmed) {
          setApplying(false);
          return;
        }
      }

      await applicationsAPI.create(parseInt(id));
      alert('지원이 완료되었습니다!');
      loadEvent();
    } catch (error) {
      console.error('Application error:', error);
      const errorMessage = error.response?.data?.detail || error.message || '지원에 실패했습니다';
      alert(errorMessage);
    } finally {
      setApplying(false);
    }
  };

  const handleCancel = async () => {
    if (!myApplication) return;
    if (!confirm('지원을 취소하시겠습니까?')) return;

    try {
      await applicationsAPI.cancel(myApplication.id);
      alert('지원이 취소되었습니다');
      loadEvent();
    } catch (error) {
      alert(error.response?.data?.detail || '취소에 실패했습니다');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-4">
        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: 'var(--color-bg)' }}>
            📋
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text-title)' }}>행사를 찾을 수 없습니다</p>
          <p className="text-sm" style={{ color: 'var(--color-text-sub)' }}>삭제되었거나 존재하지 않는 행사입니다</p>
        </div>
      </div>
    );
  }

  const formatPay = (amount) => {
    if (!amount) return '';
    return `${Number(amount).toLocaleString()}원`;
  };

  const formatPayShort = (amount) => {
    if (!amount) return '';
    return `${(amount / 10000).toFixed(0)}만원`;
  };

  // 실수령액 계산 (3.3% 원천징수)
  const calculateNetPay = (grossPay) => {
    if (!grossPay) return 0;
    const taxRate = 0.033;
    return Math.round(grossPay * (1 - taxRate));
  };

  const getStatusBadge = () => {
    if (!myApplication) return null;
    const status = myApplication.status;
    const badges = {
      PENDING: <span className="chip-pending">심사중</span>,
      CONFIRMED: <span className="chip-confirmed">확정</span>,
      REJECTED: <span className="chip-rejected">불합격</span>,
      WAITLIST: <span className="chip-waitlist">대기</span>,
    };
    return badges[status] || null;
  };

  return (
    <div className="pb-44 animate-fade-in">
      {/* 헤더 - 토스 스타일 */}
      <div className="p-4 sticky top-0 z-10" style={{ backgroundColor: 'var(--color-bg-card)' }}>
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95"
          style={{ backgroundColor: 'var(--color-bg)' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-text-secondary)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* 컨텐츠 */}
      <div className="p-4 space-y-4">
        {/* 제목 및 급여 - 토스 스타일 */}
        <div className="card">
          <div className="flex justify-between items-start mb-3">
            <h1 className="text-xl font-bold flex-1" style={{ color: 'var(--color-text-title)' }}>{event.title}</h1>
            {getStatusBadge()}
          </div>

          {/* 급여 정보 - 세전/실수령 표시 */}
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-primary-light)' }}>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
                {formatPay(event.pay_amount)}
              </span>
              <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>세전</span>
            </div>
            <div className="text-sm" style={{ color: 'var(--color-text-sub)' }}>
              실수령 {formatPay(calculateNetPay(event.pay_amount))} (3.3% 공제)
              {event.pay_description && ` · ${event.pay_description}`}
            </div>
          </div>

          {/* 신뢰 배지 - 토스 스타일 */}
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium" style={{ backgroundColor: 'var(--color-secondary-light)', color: 'var(--color-secondary)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              블록체인 보장
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              합법 프리랜서
            </span>
          </div>

          {event.status === 'OPEN' && !myApplication && (
            <div className="mt-3">
              <span className="chip-recruiting">모집중</span>
            </div>
          )}
        </div>

        {/* 상세 정보 */}
        <div className="card space-y-4">
          <h2 className="font-semibold" style={{ color: 'var(--color-text-title)' }}>행사 정보</h2>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-xl">📅</span>
              <div>
                <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                  {event.event_date}
                  {(() => {
                    const date = new Date(event.event_date);
                    const days = ['일', '월', '화', '수', '목', '금', '토'];
                    return ` (${days[date.getDay()]})`;
                  })()}
                </p>
                {event.start_time && (
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>{event.start_time} ~ {event.end_time || ''}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="text-xl">📍</span>
              <div>
                <p className="font-medium" style={{ color: 'var(--color-text)' }}>{event.location}</p>
              </div>
            </div>

            {event.work_type && (
              <div className="flex items-start gap-3">
                <span className="text-xl">💼</span>
                <div>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>{event.work_type}</p>
                </div>
              </div>
            )}

            {event.dress_code && (
              <div className="flex items-start gap-3">
                <span className="text-xl">👔</span>
                <div>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>{event.dress_code}</p>
                </div>
              </div>
            )}

            {event.age_requirement && (
              <div className="flex items-start gap-3">
                <span className="text-xl">👤</span>
                <div>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>나이: {event.age_requirement}</p>
                </div>
              </div>
            )}

            {event.meal_provided && (
              <div className="flex items-start gap-3">
                <span className="text-xl">🍽️</span>
                <div>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>식사 제공</p>
                </div>
              </div>
            )}

            {/* 자격요건 */}
            {(event.requires_driver_license || event.requires_security_cert) && (
              <div className="flex items-start gap-3">
                <span className="text-xl">✅</span>
                <div>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {[
                      event.requires_driver_license && '운전면허',
                      event.requires_security_cert && '경호이수증'
                    ].filter(Boolean).join(', ')} 필요
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 담당자 */}
        {(event.manager_name || event.manager_phone) && (
          <div className="card">
            <h2 className="font-semibold mb-3" style={{ color: 'var(--color-text-title)' }}>담당자</h2>
            {event.manager_name && <p style={{ color: 'var(--color-text-body)' }}>{event.manager_name}</p>}
            {event.manager_phone && (
              <a href={`tel:${event.manager_phone}`} className="font-medium" style={{ color: 'var(--color-primary)' }}>
                {event.manager_phone}
              </a>
            )}
          </div>
        )}

        {/* 지원 현황 */}
        <div className="card">
          <div className="flex justify-between items-center">
            <span style={{ color: 'var(--color-text-secondary)' }}>지원자</span>
            <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{event.application_count || 0}명</span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span style={{ color: 'var(--color-text-secondary)' }}>확정</span>
            <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>{event.confirmed_count || 0}명</span>
          </div>
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 z-20 shadow-lg" style={{ backgroundColor: 'var(--color-bg-card)', borderTop: '1px solid var(--color-border)' }}>
        <div className="max-w-lg mx-auto p-4">
          {/* 비로그인 상태 */}
          {!user ? (
            <div className="space-y-3">
              <Link to="/login" className="btn-cta">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                로그인하고 지원하기
              </Link>
              <p className="text-center text-sm" style={{ color: 'var(--color-text-sub)' }}>
                처음이신가요? <Link to="/register" className="font-medium" style={{ color: 'var(--color-primary)' }}>회원가입</Link>
              </p>
            </div>
          ) : !worker ? (
            /* 로그인했지만 근무자 등록 안됨 */
            <div className="space-y-2">
              <Link to="/register" className="btn-cta">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                회원등록 후 지원하기
              </Link>
              <p className="text-center text-sm" style={{ color: 'var(--color-text-sub)' }}>
                지원하려면 먼저 회원등록이 필요합니다
              </p>
            </div>
          ) : myApplication ? (
            /* 이미 지원함 */
            myApplication.status === 'PENDING' ? (
              <div className="space-y-2">
                <div className="text-center text-sm font-medium py-2 rounded-xl" style={{ backgroundColor: '#FFF8E6', color: 'var(--color-warning)' }}>
                  심사 중입니다. 곧 결과를 알려드릴게요!
                </div>
                <button
                  onClick={handleCancel}
                  className="btn-secondary w-full"
                  style={{ color: 'var(--color-error)' }}
                >
                  지원 취소
                </button>
              </div>
            ) : myApplication.status === 'CONFIRMED' ? (
              <div className="space-y-2">
                <div className="btn-cta-success text-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  확정되었습니다!
                </div>
                <p className="text-center text-xs" style={{ color: 'var(--color-text-sub)' }}>
                  행사 당일 출근 코드로 체크인하세요
                </p>
              </div>
            ) : (
              <button disabled className="btn-secondary w-full opacity-50">
                지원 완료
              </button>
            )
          ) : event.status === 'OPEN' ? (
            /* 지원 가능 */
            <button
              onClick={handleApply}
              disabled={applying}
              className="btn-cta"
            >
              {applying ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  지원 중...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  지원하기
                </>
              )}
            </button>
          ) : (
            /* 모집 마감 */
            <button disabled className="btn-secondary w-full opacity-50">
              모집 마감
            </button>
          )}
        </div>
        <div className="safe-bottom"></div>
      </div>
    </div>
  );
}
