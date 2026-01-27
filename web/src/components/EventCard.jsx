import { Link } from 'react-router-dom';

export default function EventCard({ event }) {
  const formatPay = (amount) => {
    if (!amount && amount !== 0) return '-';
    return `${Number(amount).toLocaleString()}원`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    // YYYY-MM-DD -> MM/DD
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
    }
    return dateStr;
  };

  const getStatusChip = () => {
    if (event.status === 'OPEN') {
      return <span className="chip-recruiting">모집중</span>;
    }
    if (event.status === 'CLOSED') {
      return <span className="chip-completed">마감</span>;
    }
    return null;
  };

  return (
    <Link to={`/events/${event.id}`} className="block">
      <div className="card card-hover">
        {/* 상단: 제목 + 상태칩 */}
        <div className="flex justify-between items-start gap-2 mb-2">
          <h3 className="font-semibold text-base text-gray-900 line-clamp-1">
            {event.title || '제목 없음'}
          </h3>
          {getStatusChip()}
        </div>

        {/* 급여 - 가장 크게 */}
        <p className="pay-amount mb-2">
          {formatPay(event.pay_amount)}
          {event.pay_description && (
            <span className="text-sm font-normal text-gray-500 ml-1">
              {event.pay_description}
            </span>
          )}
        </p>

        {/* 날짜 + 장소 */}
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{formatDate(event.event_date)}</span>
          {event.start_time && (
            <>
              <span className="text-gray-300">|</span>
              <span>{event.start_time}</span>
            </>
          )}
          {event.location && (
            <>
              <span className="text-gray-300">|</span>
              <span className="line-clamp-1">{event.location}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
