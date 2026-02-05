import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { applicationsAPI, aiMatchingAPI } from '../api/client';
import { formatPay, calculateNetPay } from '../utils/format';

export default function WorkCalendar() {
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [confirmedEvents, setConfirmedEvents] = useState([]);
  const [recommendedEvents, setRecommendedEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvents, setSelectedEvents] = useState([]);

  useEffect(() => {
    loadData();
  }, [currentDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [appsRes, aiRes] = await Promise.all([
        applicationsAPI.getMyList().catch(() => ({ data: { applications: [] } })),
        aiMatchingAPI.getRecommendedEvents(20, 60).catch(() => ({ data: { recommendations: [] } })),
      ]);

      // 확정된 지원 내역
      const confirmed = (appsRes.data.applications || [])
        .filter(app => app.status === 'CONFIRMED' && app.event_date)
        .map(app => ({
          id: app.id,
          eventId: app.event_id,
          date: app.event_date,
          title: app.event_title,
          pay: app.pay_amount,
          type: 'confirmed',
        }));

      // AI 추천 행사
      const recommended = (aiRes.data.recommendations || [])
        .filter(rec => rec.event_date)
        .map(rec => ({
          id: rec.event_id,
          eventId: rec.event_id,
          date: rec.event_date,
          title: rec.event_title,
          pay: rec.event_pay,
          score: rec.match_score,
          type: 'recommended',
        }));

      setConfirmedEvents(confirmed);
      setRecommendedEvents(recommended);
    } catch (error) {
      console.error('Failed to load calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 달력 생성 함수
  const generateCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const weeks = [];
    let week = new Array(7).fill(null);
    let dayCount = 1;

    // 첫 주 빈 칸 채우기
    for (let i = firstDay; i < 7 && dayCount <= daysInMonth; i++) {
      week[i] = dayCount++;
    }
    weeks.push([...week]);

    // 나머지 주 채우기
    while (dayCount <= daysInMonth) {
      week = new Array(7).fill(null);
      for (let i = 0; i < 7 && dayCount <= daysInMonth; i++) {
        week[i] = dayCount++;
      }
      weeks.push([...week]);
    }

    return weeks;
  };

  // 특정 날짜의 이벤트 가져오기
  const getEventsForDate = (day) => {
    if (!day) return { confirmed: [], recommended: [] };

    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const confirmed = confirmedEvents.filter(e => e.date === dateStr);
    const recommended = recommendedEvents.filter(e => e.date === dateStr);

    return { confirmed, recommended };
  };

  // 날짜 클릭 핸들러
  const handleDateClick = (day) => {
    if (!day) return;

    const { confirmed, recommended } = getEventsForDate(day);
    const allEvents = [...confirmed, ...recommended];

    if (allEvents.length > 0) {
      setSelectedDate(day);
      setSelectedEvents(allEvents);
    }
  };

  // 이전/다음 달 이동
  const changeMonth = (direction) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const weeks = generateCalendar();
  const today = new Date();
  const isCurrentMonth = currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 캘린더 헤더 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => changeMonth(-1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-title)' }}>
            {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
          </h2>
          <button
            onClick={() => changeMonth(1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
            <div
              key={day}
              className="text-center text-xs font-medium py-2"
              style={{
                color: idx === 0 ? '#EF4444' : idx === 6 ? '#3B82F6' : 'var(--color-text-sub)',
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="space-y-1">
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 gap-1">
              {week.map((day, dayIdx) => {
                if (!day) {
                  return <div key={dayIdx} className="aspect-square" />;
                }

                const { confirmed, recommended } = getEventsForDate(day);
                const hasConfirmed = confirmed.length > 0;
                const hasRecommended = recommended.length > 0;
                const isToday = isCurrentMonth && day === today.getDate();

                return (
                  <motion.button
                    key={day}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDateClick(day)}
                    className="aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative transition-colors"
                    style={{
                      backgroundColor: hasConfirmed
                        ? '#DBEAFE'
                        : hasRecommended
                        ? '#F3E8FF'
                        : isToday
                        ? '#FEF3C7'
                        : 'transparent',
                      color: dayIdx === 0 ? '#EF4444' : dayIdx === 6 ? '#3B82F6' : 'var(--color-text-title)',
                      fontWeight: isToday ? 'bold' : 'normal',
                      border: isToday ? '2px solid #FCD34D' : 'none',
                    }}
                  >
                    <span>{day}</span>
                    {(hasConfirmed || hasRecommended) && (
                      <div className="flex gap-0.5 mt-0.5">
                        {hasConfirmed && (
                          <div className="w-1 h-1 rounded-full bg-blue-500" />
                        )}
                        {hasRecommended && (
                          <div className="w-1 h-1 rounded-full bg-purple-500" />
                        )}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          ))}
        </div>

        {/* 범례 */}
        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-xs" style={{ color: 'var(--color-text-sub)' }}>확정</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-xs" style={{ color: 'var(--color-text-sub)' }}>AI 추천</span>
          </div>
        </div>
      </div>

      {/* 선택된 날짜의 이벤트 모달 */}
      <AnimatePresence>
        {selectedDate && selectedEvents.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setSelectedDate(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 헤더 */}
              <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between">
                <h3 className="font-bold text-lg" style={{ color: 'var(--color-text-title)' }}>
                  {currentDate.getMonth() + 1}월 {selectedDate}일 일정
                </h3>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* 이벤트 목록 */}
              <div className="p-5 space-y-3">
                {selectedEvents.map((event) => (
                  <div
                    key={`${event.type}-${event.id}`}
                    className="card"
                    style={{
                      borderLeft: `4px solid ${event.type === 'confirmed' ? '#3B82F6' : '#A855F7'}`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: event.type === 'confirmed' ? '#DBEAFE' : '#F3E8FF',
                          color: event.type === 'confirmed' ? '#1E40AF' : '#7C3AED',
                        }}
                      >
                        {event.type === 'confirmed' ? '확정' : `AI 추천 ${event.score}점`}
                      </span>
                      {event.pay && (
                        <span className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
                          {formatPay(calculateNetPay(event.pay))}
                        </span>
                      )}
                    </div>
                    <h4 className="font-semibold mb-1" style={{ color: 'var(--color-text-title)' }}>
                      {event.title}
                    </h4>
                    <button
                      onClick={() => {
                        window.location.href = `/events/${event.eventId}`;
                      }}
                      className="mt-2 w-full py-2 text-xs font-medium rounded-lg"
                      style={{
                        backgroundColor: 'var(--color-bg)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      자세히 보기 →
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
