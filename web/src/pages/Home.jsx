import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { eventsAPI, applicationsAPI, attendanceAPI, workersAPI, badgesAPI } from '../api/client';
import AIRecommendations from '../components/AIRecommendations';

// 오늘 날짜의 일정 가져오기
const getTodaySchedule = (applications, events) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return applications
    .filter(app => app.status === 'approved')
    .filter(app => {
      const event = events.find(e => e.id === app.event_id);
      if (!event) return false;

      const startDate = new Date(event.start_date);
      const endDate = new Date(event.end_date);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);

      return today >= startDate && today <= endDate;
    })
    .map(app => events.find(e => e.id === app.event_id))
    .filter(Boolean);
};

// 다가오는 일정 가져오기
const getUpcomingSchedule = (applications, events, limit = 2) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return applications
    .filter(app => app.status === 'approved')
    .map(app => ({
      ...app,
      event: events.find(e => e.id === app.event_id)
    }))
    .filter(item => {
      if (!item.event) return false;
      const startDate = new Date(item.event.start_date);
      startDate.setHours(0, 0, 0, 0);
      return startDate > today;
    })
    .sort((a, b) => new Date(a.event.start_date) - new Date(b.event.start_date))
    .slice(0, limit)
    .map(item => item.event);
};

export default function Home() {
  const { user, worker } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [myAttendance, setMyAttendance] = useState([]);
  const [myBadges, setMyBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    loadData();
  }, [worker]);

  const loadData = async () => {
    try {
      // 전체 행사 조회 (OPEN 상태만이 아닌 전체)
      const { data } = await eventsAPI.list();
      setEvents(data.events || []);

      if (worker) {
        const [appRes, attRes, badgeRes] = await Promise.all([
          applicationsAPI.getMyList(),
          attendanceAPI.getMyList(),
          badgesAPI.getMyBadges().catch(() => ({ data: { badges: [] } }))
        ]);
        setMyApplications(appRes.data.applications || []);
        setMyAttendance(attRes.data.attendance || []);
        setMyBadges(badgeRes.data.badges || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 이번달 실제 수입 계산 (퇴근 완료된 출퇴근 기록 기준, 3.3% 공제 후)
  const calculateMonthlyEarnings = () => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return myAttendance
      .filter(att => att.check_out_time && att.event_date?.startsWith(thisMonth))
      .reduce((sum, att) => {
        const grossPay = att.pay_amount || 0;
        const netPay = Math.round(grossPay * (1 - 0.033));
        return sum + netPay;
      }, 0);
  };

  // 오늘 추천 행사 (가장 높은 급여 or 가장 빠른 날짜)
  const getRecommendedEvent = () => {
    // 모집중이고 날짜가 안 지난 행사만 대상
    const activeEvents = events.filter(e => e.status === 'OPEN' && !isEventPast(e.event_date));
    if (activeEvents.length === 0) return null;

    // 이미 지원한 이벤트 ID 목록
    const appliedEventIds = myApplications.map(app => app.event_id);

    // 지원하지 않은 이벤트 중 가장 급여 높은 것
    const availableEvents = activeEvents.filter(e => !appliedEventIds.includes(e.id));

    if (availableEvents.length === 0) return activeEvents[0]; // 모두 지원했으면 첫번째

    return availableEvents.sort((a, b) => (b.pay_amount || 0) - (a.pay_amount || 0))[0];
  };

  const formatPay = (amount) => {
    if (!amount && amount !== 0) return '-';
    return `${Number(amount).toLocaleString()}원`;
  };

  // 실수령액 계산 (3.3% 원천징수)
  const calculateNetPay = (grossPay) => {
    if (!grossPay) return 0;
    const taxRate = 0.033; // 소득세 3% + 지방소득세 0.3%
    return Math.round(grossPay * (1 - taxRate));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      return `${parseInt(parts[parts.length - 2])}월 ${parseInt(parts[parts.length - 1])}일`;
    }
    return dateStr;
  };

  // 행사 날짜가 지났는지 확인
  const isEventPast = (eventDate) => {
    if (!eventDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let eventDay;

    // ISO 형식 (2026-01-26) 체크
    if (eventDate.includes('-') && eventDate.length === 10) {
      eventDay = new Date(eventDate);
    }
    // 한국어 형식 (01월 25일) 체크
    else if (eventDate.includes('월') && eventDate.includes('일')) {
      const match = eventDate.match(/(\d{1,2})월\s*(\d{1,2})일/);
      if (match) {
        const month = parseInt(match[1]) - 1;
        const day = parseInt(match[2]);
        const year = today.getFullYear();
        eventDay = new Date(year, month, day);
      } else {
        return false;
      }
    } else {
      return false;
    }

    eventDay.setHours(0, 0, 0, 0);
    return eventDay < today;
  };

  // 모집중인 행사만 필터 (날짜가 안 지난 OPEN 상태)
  const openEvents = events.filter(e => e.status === 'OPEN' && !isEventPast(e.event_date));

  const recommendedEvent = getRecommendedEvent();
  const monthlyEarnings = calculateMonthlyEarnings();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* 1. 사용자 상태 카드 - 토스 스타일 */}
      {user ? (
        worker ? (
          // 등록된 근무자
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl overflow-hidden" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                {worker.face_photo_file_id ? (
                  <img
                    src={workersAPI.getPhotoUrlFromPath(worker.face_photo_file_id) + `?v=${Date.now()}`}
                    alt="프로필"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '👤'; }}
                  />
                ) : (
                  '👤'
                )}
              </div>
              <div className="flex-1">
                <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>안녕하세요</p>
                <h2 className="font-bold text-lg" style={{ color: 'var(--color-text-title)' }}>{worker.name}님</h2>
              </div>
              {/* 배지 카운트 */}
              {myBadges.length > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ backgroundColor: 'var(--color-secondary-light)' }}>
                  <span className="text-sm">🏅</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-secondary)' }}>{myBadges.length}</span>
                </div>
              )}
            </div>

            {/* 배지 표시 */}
            {myBadges.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-sub)' }}>내 배지</span>
                  <Link to="/badges" className="text-xs" style={{ color: 'var(--color-primary)' }}>전체보기</Link>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {myBadges.slice(0, 5).map((badge) => (
                    <div
                      key={badge.id}
                      className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border"
                      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
                      title={badge.description}
                    >
                      <span className="text-sm">{badge.icon}</span>
                      <span className="text-xs font-medium whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                        {badge.title}
                      </span>
                    </div>
                  ))}
                  {myBadges.length > 5 && (
                    <Link
                      to="/badges"
                      className="flex-shrink-0 flex items-center justify-center px-3 py-1.5 rounded-full"
                      style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-sub)' }}
                    >
                      <span className="text-xs">+{myBadges.length - 5}개</span>
                    </Link>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between py-3 px-4 rounded-xl" style={{ backgroundColor: 'var(--color-bg)' }}>
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>이번달 예상 수입</span>
              <span className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>{formatPay(monthlyEarnings)}</span>
            </div>
          </div>
        ) : (
          // 미등록 사용자
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: 'var(--color-bg)' }}>
                👋
              </div>
              <div>
                <p className="font-bold" style={{ color: 'var(--color-text-title)' }}>회원가입을 완료하세요</p>
                <p className="text-sm" style={{ color: 'var(--color-text-sub)' }}>프로필 등록 후 바로 지원 가능</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/register')}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              회원가입 완료하기
            </button>
          </div>
        )
      ) : (
        // 비로그인
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: 'var(--color-primary-light)' }}>
              💼
            </div>
            <div>
              <p className="font-bold" style={{ color: 'var(--color-text-title)' }}>오늘 바로 일하고 돈 버세요</p>
              <p className="text-sm" style={{ color: 'var(--color-text-sub)' }}>블록체인으로 근무기록 100% 보장</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            시작하기
          </button>
        </div>
      )}

      {/* 내 일정 위젯 (로그인한 워커만) */}
      {worker && (
        <Link to="/calendar" className="block">
          <div className="card p-4 transition-all active:scale-[0.98]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📅</span>
                <h3 className="font-bold" style={{ color: 'var(--color-text-title)' }}>내 일정</h3>
              </div>
              <span className="text-xs" style={{ color: 'var(--color-primary)' }}>전체보기 →</span>
            </div>

            {(() => {
              const todaySchedule = getTodaySchedule(myApplications, events);
              const upcomingSchedule = getUpcomingSchedule(myApplications, events, 2);

              if (todaySchedule.length === 0 && upcomingSchedule.length === 0) {
                return (
                  <div className="text-center py-6">
                    <p className="text-sm mb-2" style={{ color: 'var(--color-text-sub)' }}>예정된 일정이 없습니다</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>아래에서 행사를 둘러보세요</p>
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {/* 오늘 일정 */}
                  {todaySchedule.map(event => (
                    <div key={event.id} className="p-3 rounded-xl bg-gradient-to-r from-orange-50 to-pink-50 border border-orange-200">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500 text-white">오늘</span>
                        <span className="text-sm font-bold" style={{ color: 'var(--color-text-title)' }}>{event.title}</span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        📍 {event.location} • 🕒 {event.start_time || event.event_time}
                      </p>
                    </div>
                  ))}

                  {/* 다가오는 일정 */}
                  {upcomingSchedule.map(event => {
                    const daysUntil = Math.ceil((new Date(event.start_date) - new Date()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={event.id} className="p-3 rounded-xl" style={{ backgroundColor: 'var(--color-bg)' }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-title)' }}>{event.title}</span>
                          <span className="text-xs font-bold" style={{ color: 'var(--color-primary)' }}>D-{daysUntil}</span>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          {formatDate(event.start_date)} • {event.work_type || event.category_name || '일반'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </Link>
      )}

      {/* AI 추천 행사 (로그인한 워커만) */}
      {worker && (
        <div className="mb-6">
          <AIRecommendations limit={5} />
        </div>
      )}

      {/* 3. 추천 행사 - 프리미엄 카드 디자인 */}
      {recommendedEvent && (
        <div>
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>추천 행사</p>
          <div className="card relative overflow-hidden" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            {/* 추천 뱃지 - 카드 안에 자연스럽게 */}
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: 'var(--color-secondary-light)', color: 'var(--color-secondary)' }}>
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                추천
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium" style={{ backgroundColor: 'var(--color-secondary-light)', color: 'var(--color-secondary)' }}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                블록체인 보장
              </span>
            </div>

            {/* 급여 정보 - 네이비로 강조 */}
            <div className="mb-4">
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>
                  {formatPay(recommendedEvent.pay_amount)}
                </span>
                <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>세전</span>
              </div>
              <div className="text-sm" style={{ color: 'var(--color-text-sub)' }}>
                실수령 {formatPay(calculateNetPay(recommendedEvent.pay_amount))}
                {recommendedEvent.pay_description && ` · ${recommendedEvent.pay_description}`}
              </div>
            </div>

            {/* 행사 정보 */}
            <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--color-text-title)' }}>{recommendedEvent.title}</h3>

            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDate(recommendedEvent.event_date)}
              </span>
              {recommendedEvent.work_type && (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {recommendedEvent.work_type}
                </span>
              )}
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {recommendedEvent.location}
              </span>
            </div>

            {/* CTA 버튼 - 네이비 */}
            {worker ? (
              <button
                onClick={() => navigate(`/events/${recommendedEvent.id}`)}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
                style={{ backgroundColor: 'var(--color-navy)' }}
              >
                바로 지원하기
              </button>
            ) : (
              <button
                onClick={() => navigate(user ? '/register' : '/login')}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
                style={{ backgroundColor: 'var(--color-navy)' }}
              >
                {user ? '회원가입 후 지원하기' : '로그인하고 지원하기'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. 전체 행사 리스트 - 토스 스타일 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>전체 행사</p>
          {events.length > 0 && (
            <span className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
              {openEvents.length > 0 ? `${openEvents.length}개 모집중` : '모집중인 행사 없음'}
            </span>
          )}
        </div>

        {events.length > 0 ? (
          <div className="space-y-2">
            {events.map((event) => (
              <Link key={event.id} to={`/events/${event.id}`} className="card card-hover block">
                <div className="flex justify-between items-start mb-1">
                  {/* 세전 금액 강조 - 네이비 */}
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold" style={{ color: isEventPast(event.event_date) ? 'var(--color-text-disabled)' : 'var(--color-navy)' }}>
                      {formatPay(event.pay_amount)}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--color-text-sub)' }}>세전</span>
                  </div>
                  {isEventPast(event.event_date) ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: '#F3F4F6', color: '#9CA3AF' }}>행사종료</span>
                  ) : event.status === 'CLOSED' || event.status === 'COMPLETED' ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>모집종료</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>모집중</span>
                  )}
                </div>

                {/* 실수령 + pay_description */}
                <div className="text-xs mb-2" style={{ color: 'var(--color-text-sub)' }}>
                  실수령 {formatPay(calculateNetPay(event.pay_amount))}
                  {event.pay_description && ` · ${event.pay_description}`}
                </div>

                <h3 className="font-semibold mb-1" style={{ color: isEventPast(event.event_date) ? 'var(--color-text-disabled)' : 'var(--color-text-title)' }}>{event.title}</h3>

                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-sub)' }}>
                  <span>{formatDate(event.event_date)}</span>
                  {event.work_type && (
                    <>
                      <span style={{ color: 'var(--color-border)' }}>|</span>
                      <span>{event.work_type}</span>
                    </>
                  )}
                  <span style={{ color: 'var(--color-border)' }}>|</span>
                  <span className="truncate">{event.location}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: 'var(--color-bg)' }}>
              📋
            </div>
            <p className="font-semibold mb-1" style={{ color: 'var(--color-text-title)' }}>등록된 행사가 없어요</p>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-sub)' }}>
              새로운 행사가 등록되면<br />가장 먼저 알려드릴게요
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-[0.98]"
              style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
            >
              새로고침
            </button>
          </div>
        )}
      </div>

      {/* 5. 신규 유저 온보딩 가이드 - 토스 스타일 */}
      {worker && myApplications.length === 0 && openEvents.length > 0 && (
        <div className="card relative overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--color-navy) 0%, var(--color-navy-light) 100%)' }}>
          <div className="absolute top-0 right-0 w-32 h-32 opacity-10" style={{ background: 'radial-gradient(circle, white 20%, transparent 20%)', backgroundSize: '16px 16px' }} />
          <div className="relative z-10">
            <p className="text-white/60 text-sm mb-1">처음이시군요!</p>
            <h3 className="text-white font-bold text-lg mb-4">
              3단계로 첫 수입 시작하기
            </h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-3 text-white/80">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>1</span>
                <span>원하는 행사에 지원하기</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>2</span>
                <span>승인되면 출근 코드로 체크인</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>3</span>
                <span>퇴근 후 급여 수령!</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
