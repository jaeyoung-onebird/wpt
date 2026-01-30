import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { nftAPI } from '../../api/client';

export default function CompletedEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const { data } = await nftAPI.getCompletedEvents();
      setEvents(data.events || []);
    } catch (error) {
      console.error('Failed to load completed events:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">NFT 배지 발행</h1>
          <p className="text-gray-600 mt-1">종료된 행사에서 프로젝트 배지를 발급할 수 있습니다</p>
        </div>
        <button
          onClick={() => navigate('/admin/events')}
          className="text-sm text-blue-600 hover:underline"
        >
          전체 행사 보기
        </button>
      </div>

      {/* 이벤트 목록 */}
      {events.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-gray-900">종료된 행사가 없습니다</h3>
          <p className="text-gray-500 mt-1">행사가 종료되면 여기에 표시됩니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-white rounded-lg border p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-gray-900">{event.title}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {event.location}
                      </span>
                    )}
                    {event.event_date && (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(event.event_date).toLocaleDateString('ko-KR')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* 통계 */}
                  <div className="text-center px-4 py-2 bg-gray-50 rounded-lg">
                    <div className="text-lg font-bold text-gray-900">{event.completed_workers}</div>
                    <div className="text-xs text-gray-500">참여 근무자</div>
                  </div>

                  {event.batch_count > 0 && (
                    <div className="text-center px-4 py-2 bg-blue-50 rounded-lg">
                      <div className="text-lg font-bold text-blue-600">{event.batch_count}</div>
                      <div className="text-xs text-blue-500">발급 완료</div>
                    </div>
                  )}
                </div>
              </div>

              {/* 액션 버튼 */}
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <span className="text-sm text-gray-400">
                  종료: {event.updated_at ? new Date(event.updated_at).toLocaleDateString('ko-KR') : '-'}
                </span>

                <Link
                  to={`/admin/events/${event.id}/nft-issue`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  NFT 배지 발행
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
