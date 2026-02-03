import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { applicationsAPI, eventsAPI } from '../api/client';
import { formatDate } from '../utils/format';

export default function CalendarPage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [events, setEvents] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week'
  const [monthStats, setMonthStats] = useState({
    workDays: 0,
    totalPay: 0,
    eventCount: 0,
    byClient: {},
    byJobType: {}
  });

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const { data } = await applicationsAPI.getMyApplications();

      // 승인된 지원만 필터링
      const approved = data.filter(app => app.status === 'approved');
      setApplications(approved);

      // 이벤트 정보 가져오기
      const eventIds = [...new Set(approved.map(app => app.event_id))];
      const eventData = {};

      for (const eventId of eventIds) {
        try {
          const { data: event } = await eventsAPI.getEvent(eventId);
          eventData[eventId] = event;
        } catch (error) {
          console.error(`Failed to load event ${eventId}:`, error);
        }
      }

      setEvents(eventData);
      calculateMonthStats(approved, eventData);
    } catch (error) {
      console.error('Failed to load applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMonthStats = (apps, eventsData) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let workDays = 0;
    let totalPay = 0;
    const eventSet = new Set();
    const byClient = {};
    const byJobType = {};

    apps.forEach(app => {
      const event = eventsData[app.event_id];
      if (!event) return;

      const startDate = new Date(event.start_date);
      const endDate = new Date(event.end_date);

      if (startDate.getMonth() === currentMonth && startDate.getFullYear() === currentYear) {
        // 근무일 계산
        const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        workDays += days;

        // ✅ 수정: 행사별 고정 급여 합산 (시급 계산 아님)
        if (event.pay_amount) {
          totalPay += event.pay_amount;

          // 업체별 집계
          const client = event.client_name || event.manager_name || '기타';
          byClient[client] = (byClient[client] || 0) + event.pay_amount;

          // 직종별 집계
          const jobType = event.work_type || event.category_name || '일반';
          byJobType[jobType] = (byJobType[jobType] || 0) + event.pay_amount;
        }

        eventSet.add(app.event_id);
      }
    });

    setMonthStats({
      workDays,
      totalPay,
      eventCount: eventSet.size,
      byClient,
      byJobType,
    });
  };

  // 업체별 고유 색상
  const getEventColor = (event) => {
    const client = event?.client_name || event?.manager_name || '기타';

    // 주요 업체별 고정 색상
    const colorMap = {
      '롯데호텔': '#003C7E',
      '롯데백화점': '#003C7E',
      '신세계백화점': '#E31E2D',
      'JW메리어트': '#8B0000',
      '현대백화점': '#00A0E9',
      '코엑스': '#0066CC',
      '삼성': '#1428A0',
      'LG': '#A50034',
    };

    if (colorMap[client]) {
      return colorMap[client];
    }

    // 해시 기반 색상 생성
    let hash = 0;
    for (let i = 0; i < client.length; i++) {
      hash = client.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
    return colors[Math.abs(hash) % colors.length];
  };

  // 직종별 아이콘
  const getJobTypeIcon = (jobType) => {
    const icons = {
      '행사스탭': '🎤',
      '발렛파킹': '🚗',
      '경호': '🛡️',
      '도슨트': '🎨',
      '도우미': '🤝',
      '어셔': '🎭',
      '의전드라이버': '🚘',
      '의전차량': '🚙',
    };
    return icons[jobType] || '💼';
  };

  // 특정 날짜에 해당하는 이벤트 가져오기
  const getEventsForDate = (date) => {
    return applications.filter(app => {
      const event = events[app.event_id];
      if (!event) return false;

      const startDate = new Date(event.start_date);
      const endDate = new Date(event.end_date);

      // 시간 정보 제거하고 날짜만 비교
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);

      return checkDate >= startDate && checkDate <= endDate;
    });
  };

  // 오늘 일정
  const todayEvents = getEventsForDate(new Date());

  // 다가오는 일정 (오늘 이후 3개)
  const upcomingEvents = applications
    .filter(app => {
      const event = events[app.event_id];
      if (!event) return false;
      const startDate = new Date(event.start_date);
      return startDate > new Date();
    })
    .sort((a, b) => {
      const dateA = new Date(events[a.event_id]?.start_date);
      const dateB = new Date(events[b.event_id]?.start_date);
      return dateA - dateB;
    })
    .slice(0, 3);

  // 캘린더 타일 콘텐츠
  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null;

    const dayEvents = getEventsForDate(date);
    if (dayEvents.length === 0) return null;

    // 최대 3개까지만 표시
    const displayEvents = dayEvents.slice(0, 3);

    return (
      <div className="flex flex-col gap-1 mt-1">
        {displayEvents.map((app, index) => {
          const event = events[app.event_id];
          if (!event) return null;

          return (
            <div
              key={app.id}
              className="text-xs px-1 py-0.5 rounded truncate"
              style={{
                backgroundColor: getEventColor(event),
                color: 'white',
                fontSize: '10px'
              }}
              title={event.title}
            >
              {event.title}
            </div>
          );
        })}
        {dayEvents.length > 3 && (
          <div className="text-xs text-gray-500 px-1">
            +{dayEvents.length - 3}
          </div>
        )}
      </div>
    );
  };

  // 캘린더 타일 클래스
  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return '';

    const dayEvents = getEventsForDate(date);
    if (dayEvents.length > 0) {
      return 'has-events';
    }
    return '';
  };

  // 날짜 클릭 핸들러
  const handleDateClick = (date) => {
    setSelectedDate(date);
  };

  // 선택된 날짜의 이벤트
  const selectedDateEvents = getEventsForDate(selectedDate);

  // 업체 목록 (범례용)
  const uniqueClients = [...new Set(
    Object.values(events).map(e => e.client_name || e.manager_name || '기타')
  )];

  // 주간 뷰 헬퍼 함수
  const getWeekDays = () => {
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());

    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const goToPrevWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() - 7);
    setSelectedDate(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + 7);
    setSelectedDate(newDate);
  };

  const isSameDay = (d1, d2) => {
    return d1.getDate() === d2.getDate() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getFullYear() === d2.getFullYear();
  };

  // 주간 통계
  const weekStats = (() => {
    const weekDays = getWeekDays();
    let workDays = 0;
    let totalPay = 0;

    weekDays.forEach(day => {
      const dayEvents = getEventsForDate(day);
      if (dayEvents.length > 0) {
        workDays++;
        dayEvents.forEach(app => {
          const event = events[app.event_id];
          if (event?.pay_amount) {
            totalPay += event.pay_amount;
          }
        });
      }
    });

    return { workDays, totalPay };
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      {/* 오늘 일정 강조 */}
      {todayEvents.length > 0 && (
        <div className="bg-gradient-to-r from-orange-400 to-pink-500 rounded-2xl p-4 mb-4 text-white shadow-lg">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            🔔 오늘의 근무
          </h3>
          {todayEvents.map(app => {
            const event = events[app.event_id];
            return (
              <div key={app.id} className="bg-white/20 backdrop-blur rounded-xl p-3 mb-2 last:mb-0">
                <p className="font-bold text-lg mb-1">{event.title}</p>
                <div className="space-y-1 text-sm">
                  <p>📍 {event.location}</p>
                  <p>🕒 {event.start_time || event.event_time} ~ {event.end_time || ''}</p>
                  <p>💼 {event.work_type || event.category_name || '일반'}</p>
                  {event.pay_amount && (
                    <p className="font-bold text-yellow-200">
                      💰 {event.pay_amount.toLocaleString()}원
                    </p>
                  )}
                </div>
                <button
                  onClick={() => navigate(`/events/${event.id}`)}
                  className="mt-2 w-full bg-white text-orange-500 font-semibold py-2 rounded-lg"
                >
                  상세보기
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 월간 통계 */}
      <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-4 mb-4 text-white shadow-lg">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          📅 {new Date().getMonth() + 1}월 일정 요약
        </h2>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white/20 backdrop-blur rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{monthStats.eventCount}</p>
            <p className="text-xs opacity-90">행사 수</p>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{monthStats.workDays}</p>
            <p className="text-xs opacity-90">근무일</p>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">
              {(monthStats.totalPay / 10000).toFixed(0)}
            </p>
            <p className="text-xs opacity-90">만원</p>
          </div>
        </div>

        {/* 업체별 급여 분석 */}
        {Object.keys(monthStats.byClient).length > 0 && (
          <div className="bg-white/10 backdrop-blur rounded-xl p-3">
            <p className="text-xs opacity-90 mb-2">업체별 급여</p>
            <div className="space-y-1.5">
              {Object.entries(monthStats.byClient).map(([client, amount]) => (
                <div key={client} className="flex justify-between items-center">
                  <span className="flex items-center gap-2 text-sm">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getEventColor({client_name: client}) }}
                    />
                    {client}
                  </span>
                  <span className="font-semibold text-sm">
                    {(amount / 10000).toFixed(0)}만원
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 직종별 통계 */}
      {Object.keys(monthStats.byJobType).length > 0 && (
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <h3 className="font-semibold mb-3">💼 직종별 근무 현황</h3>
          <div className="space-y-2">
            {Object.entries(monthStats.byJobType).map(([jobType, amount]) => {
              const count = applications.filter(app => {
                const event = events[app.event_id];
                const eventJobType = event?.work_type || event?.category_name || '일반';
                return eventJobType === jobType;
              }).length;

              return (
                <div key={jobType} className="flex justify-between items-center">
                  <span className="text-sm">
                    {getJobTypeIcon(jobType)} {jobType}
                  </span>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-600">
                      {(amount / 10000).toFixed(0)}만원
                    </p>
                    <p className="text-xs text-gray-500">{count}건</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 다가오는 일정 */}
      {upcomingEvents.length > 0 && (
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            ⏰ 다가오는 일정
          </h3>
          {upcomingEvents.map(app => {
            const event = events[app.event_id];
            const daysUntil = Math.ceil((new Date(event.start_date) - new Date()) / (1000 * 60 * 60 * 24));

            return (
              <div
                key={app.id}
                className="flex items-center gap-3 p-3 border rounded-xl mb-2 last:mb-0 cursor-pointer hover:bg-gray-50"
                onClick={() => navigate(`/events/${event.id}`)}
              >
                <div className="flex-shrink-0 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {new Date(event.start_date).getDate()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(event.start_date).getMonth() + 1}월
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{event.title}</p>
                  <p className="text-sm text-gray-600">{event.work_type || event.category_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-orange-600">
                    D-{daysUntil}
                  </p>
                  <p className="text-xs text-gray-500">
                    {event.start_time || event.event_time}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 업체 범례 */}
      {uniqueClients.length > 0 && (
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-2">행사 업체</h3>
          <div className="flex flex-wrap gap-2">
            {uniqueClients.map(client => (
              <div key={client} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getEventColor({client_name: client}) }}
                />
                <span className="text-xs text-gray-700">{client}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 월간/주간 뷰 전환 */}
      <div className="flex gap-2 mb-4 bg-white rounded-2xl p-2 shadow-sm">
        <button
          className={`flex-1 py-2 rounded-xl font-semibold transition ${
            viewMode === 'month'
              ? 'bg-blue-500 text-white'
              : 'text-gray-600'
          }`}
          onClick={() => setViewMode('month')}
        >
          월간
        </button>
        <button
          className={`flex-1 py-2 rounded-xl font-semibold transition ${
            viewMode === 'week'
              ? 'bg-blue-500 text-white'
              : 'text-gray-600'
          }`}
          onClick={() => setViewMode('week')}
        >
          주간
        </button>
      </div>

      {/* 월간 뷰 */}
      {viewMode === 'month' && (
        <>
          <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm calendar-container">
            <Calendar
              value={selectedDate}
              onClickDay={handleDateClick}
              tileContent={tileContent}
              tileClassName={tileClassName}
              locale="ko-KR"
              formatDay={(locale, date) => date.getDate()}
            />
          </div>

          {/* 선택된 날짜의 일정 */}
          {selectedDateEvents.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="font-bold mb-3">
                {formatDate(selectedDate)} 일정
              </h3>
              <div className="space-y-3">
                {selectedDateEvents.map(app => {
                  const event = events[app.event_id];
                  if (!event) return null;

                  return (
                    <div
                      key={app.id}
                      className="border rounded-xl p-3 cursor-pointer hover:bg-gray-50"
                      onClick={() => navigate(`/events/${event.id}`)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{event.title}</h4>
                        <span className="text-sm text-blue-600">승인됨</span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>📍 {event.location}</p>
                        <p>🕒 {event.start_time || event.event_time} ~ {event.end_time || ''}</p>
                        {event.pay_amount && (
                          <p className="text-orange-600 font-semibold">
                            💰 {event.pay_amount.toLocaleString()}원
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* 주간 뷰 */}
      {viewMode === 'week' && (
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={goToPrevWeek}
              className="px-3 py-1 rounded-lg bg-gray-100 text-sm font-medium"
            >
              ← 이전 주
            </button>
            <h3 className="font-bold">
              {getWeekDays()[0].getMonth() + 1}월 {getWeekDays()[0].getDate()}일 ~ {getWeekDays()[6].getDate()}일
            </h3>
            <button
              onClick={goToNextWeek}
              className="px-3 py-1 rounded-lg bg-gray-100 text-sm font-medium"
            >
              다음 주 →
            </button>
          </div>

          <div className="space-y-3">
            {getWeekDays().map(day => {
              const dayEvents = getEventsForDate(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className={`border rounded-xl p-3 ${
                    isToday ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">
                      {['일', '월', '화', '수', '목', '금', '토'][day.getDay()]}요일
                      {isToday && <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">오늘</span>}
                    </span>
                    <span className="text-sm text-gray-500">
                      {day.getMonth() + 1}/{day.getDate()}
                    </span>
                  </div>

                  {dayEvents.length > 0 ? (
                    <div className="space-y-2">
                      {dayEvents.map(app => {
                        const event = events[app.event_id];
                        return (
                          <div
                            key={app.id}
                            className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                            onClick={() => navigate(`/events/${event.id}`)}
                          >
                            <div
                              className="w-1 h-12 rounded-full flex-shrink-0"
                              style={{ backgroundColor: getEventColor(event) }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">
                                {event.title}
                              </p>
                              <p className="text-xs text-gray-600">
                                {event.start_time || event.event_time} ~ {event.end_time || ''}
                              </p>
                              {event.pay_amount && (
                                <p className="text-xs text-green-600 font-semibold">
                                  {event.pay_amount.toLocaleString()}원
                                </p>
                              )}
                            </div>
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded">
                              {event.work_type || event.category_name || '일반'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-2">
                      일정 없음
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* 주간 통계 */}
          <div className="mt-4 pt-4 border-t flex justify-around">
            <div className="text-center">
              <p className="text-sm text-gray-500">근무일</p>
              <p className="text-xl font-bold text-blue-600">{weekStats.workDays}일</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">예상 급여</p>
              <p className="text-xl font-bold text-green-600">
                {(weekStats.totalPay / 10000).toFixed(0)}만원
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 일정이 없을 때 */}
      {applications.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center">
          <p className="text-gray-500 mb-4">아직 승인된 일정이 없습니다</p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            행사 둘러보기
          </button>
        </div>
      )}

      <style>{`
        .calendar-container .react-calendar {
          width: 100%;
          border: none;
          font-family: inherit;
        }

        .calendar-container .react-calendar__tile {
          padding: 0.5rem 0.25rem;
          height: auto;
          min-height: 60px;
        }

        .calendar-container .react-calendar__tile--active {
          background: #e0e7ff;
          color: #4f46e5;
        }

        .calendar-container .react-calendar__tile--now {
          background: #fef3c7;
        }

        .calendar-container .react-calendar__month-view__days__day--weekend {
          color: #ef4444;
        }

        .calendar-container .has-events {
          font-weight: 600;
        }

        .calendar-container .react-calendar__navigation button {
          font-size: 1rem;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
