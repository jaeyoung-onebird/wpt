import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { eventsAPI } from '../../api/client';

export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    window.scrollTo(0, 0);
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const { data } = await eventsAPI.getList();
      setEvents(data.events || []);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  // 통일된 3가지 상태: 모집중, 모집종료, 행사종료
  const getEventStatus = (event) => {
    const eventDate = event.work_date || event.event_date;
    const today = new Date().toISOString().split('T')[0];
    const isPast = eventDate && eventDate < today;

    // 날짜가 지났으면 행사종료
    if (isPast) return 'EVENT_ENDED';

    // CLOSED 또는 COMPLETED 상태면 모집종료
    if (event.status === 'CLOSED' || event.status === 'COMPLETED') return 'RECRUITMENT_CLOSED';

    // OPEN 상태이고 날짜가 안 지났으면 모집중
    if (event.status === 'OPEN') return 'RECRUITING';

    // 기타 (CANCELLED 등)
    return event.status;
  };

  const filteredEvents = events.filter((event) => {
    if (filter === 'all') return true;
    return getEventStatus(event) === filter;
  });

  const getStatusBadge = (event) => {
    const status = getEventStatus(event);
    const badges = {
      RECRUITING: <span className="chip-recruiting">모집중</span>,
      RECRUITMENT_CLOSED: <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>모집종료</span>,
      EVENT_ENDED: <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: '#F3F4F6', color: '#9CA3AF' }}>행사종료</span>,
      CANCELLED: <span className="chip-rejected">취소</span>,
    };
    return badges[status] || null;
  };

  const filters = [
    { key: 'all', label: '전체' },
    { key: 'RECRUITING', label: '모집중' },
    { key: 'RECRUITMENT_CLOSED', label: '모집종료' },
    { key: 'EVENT_ENDED', label: '행사종료' },
  ];

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
      <div className="pt-2 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-title)' }}>행사 관리</h1>
          <p className="mt-1" style={{ color: 'var(--color-text-sub)' }}>총 {events.length}건</p>
        </div>
        <Link
          to="/admin/events/new"
          className="px-4 py-2 rounded-xl text-xs font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' }}
        >
          + 새 행사
        </Link>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
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
          </button>
        ))}
      </div>

      {/* 행사 목록 */}
      {filteredEvents.length > 0 ? (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          {filteredEvents.map((event, index) => (
            <Link key={event.id} to={`/admin/events/${event.id}`}>
              <div
                className="flex items-center gap-3 py-3.5 px-4"
                style={{ borderBottom: index < filteredEvents.length - 1 ? '1px solid var(--color-border)' : 'none' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
                  {getStatusBadge(event) ? (
                    event.status === 'OPEN' ? '📋' : '✅'
                  ) : '📋'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" style={{ color: 'var(--color-text-title)' }}>{event.title}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>
                    {event.event_date} · {event.location} · 지원 {event.application_count || 0}명
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(event)}
                  <span style={{ color: 'var(--color-text-sub)' }}>&rarr;</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl p-6 text-center" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-disabled)' }}>
            {filter === 'all' ? '등록된 행사가 없습니다' : '해당하는 행사가 없습니다'}
          </p>
        </div>
      )}
    </div>
  );
}
