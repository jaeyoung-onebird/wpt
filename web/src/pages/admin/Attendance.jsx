import { useState, useEffect } from 'react';
import { adminAPI, eventsAPI } from '../../api/client';
import { formatTime, calculateWorkHours } from '../../utils/format';

export default function AdminAttendance() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const { data } = await eventsAPI.getList();
      const sortedEvents = (data.events || []).sort(
        (a, b) => new Date(b.work_date) - new Date(a.work_date)
      );
      setEvents(sortedEvents);
      if (sortedEvents.length > 0) {
        selectEvent(sortedEvents[0]);
      }
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectEvent = async (event) => {
    setSelectedEvent(event);
    setLoadingAttendance(true);
    try {
      const { data } = await adminAPI.getEventAttendance(event.id);
      setAttendance(data.attendance || []);
    } catch (error) {
      console.error('Failed to load attendance:', error);
      setAttendance([]);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const handleCheckOut = async (attendanceId) => {
    if (!confirm('이 근무자를 퇴근 처리하시겠습니까?')) return;

    try {
      await adminAPI.manualCheckOut(attendanceId);
      selectEvent(selectedEvent);
    } catch (error) {
      alert(error.response?.data?.detail || '퇴근 처리에 실패했습니다');
    }
  };

  const handleCheckIn = async (attendanceId) => {
    if (!confirm('이 근무자를 출근 처리하시겠습니까?')) return;

    try {
      await adminAPI.manualCheckIn(attendanceId);
      selectEvent(selectedEvent);
    } catch (error) {
      alert(error.response?.data?.detail || '출근 처리에 실패했습니다');
    }
  };

  const handleExportExcel = async () => {
    if (!selectedEvent) return;

    setExporting(true);
    try {
      const response = await adminAPI.exportPayroll(selectedEvent.id);

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `급여명세_${selectedEvent.title}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert(error.response?.data?.detail || '엑셀 다운로드에 실패했습니다');
    } finally {
      setExporting(false);
    }
  };

  const handleExportReport = async () => {
    if (!selectedEvent) return;

    setExportingReport(true);
    try {
      const response = await adminAPI.exportReport(selectedEvent.id);

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `행사보고서_${selectedEvent.title}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert(error.response?.data?.detail || '행사보고서 다운로드에 실패했습니다');
    } finally {
      setExportingReport(false);
    }
  };

  const getStatusChip = (record) => {
    if (record.check_out_time) {
      return <span className="chip-completed">퇴근</span>;
    }
    if (record.check_in_time) {
      return <span className="chip-confirmed">근무중</span>;
    }
    return <span className="chip-pending">대기</span>;
  };

  const getWorkHours = (record) => {
    return calculateWorkHours(record.check_in_time, record.check_out_time, '-');
  };

  // 통계
  const checkedIn = attendance.filter((a) => a.check_in_time && !a.check_out_time).length;
  const checkedOut = attendance.filter((a) => a.check_out_time).length;
  const waiting = attendance.filter((a) => !a.check_in_time).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* 헤더 */}
      <div className="pt-1">
        <h1 className="text-xl font-bold text-gray-900">출석 관리</h1>
      </div>

      {/* 행사 선택 드롭다운 */}
      <select
        value={selectedEvent?.id || ''}
        onChange={(e) => {
          const event = events.find((ev) => ev.id === parseInt(e.target.value));
          if (event) selectEvent(event);
        }}
        className="select"
      >
        {events.length === 0 ? (
          <option value="">행사 없음</option>
        ) : (
          events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title} ({event.work_date || event.event_date})
            </option>
          ))
        )}
      </select>

      {/* 요약 라인 */}
      {selectedEvent && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex gap-4">
            <span className="text-gray-500">
              근무중 <span className="font-semibold text-gray-900">{checkedIn}</span>
            </span>
            <span className="text-gray-500">
              퇴근 <span className="font-semibold text-gray-900">{checkedOut}</span>
            </span>
            <span className="text-gray-500">
              대기 <span className="font-semibold text-gray-900">{waiting}</span>
            </span>
          </div>
          <span className="text-gray-400">총 {attendance.length}명</span>
        </div>
      )}

      {/* 엑셀 다운로드 버튼들 */}
      {selectedEvent && attendance.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="py-2.5 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' }}
          >
            <span>📄</span>
            {exporting ? '다운로드 중...' : '급여명세서'}
          </button>
          <button
            onClick={handleExportReport}
            disabled={exportingReport}
            className="py-2.5 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)' }}
          >
            <span>📊</span>
            {exportingReport ? '다운로드 중...' : '행사보고서'}
          </button>
        </div>
      )}

      {/* 출석 목록 */}
      {loadingAttendance ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
        </div>
      ) : attendance.length > 0 ? (
        <div className="space-y-2">
          {attendance.map((record) => (
            <div key={record.id} className="card">
              {/* 상단: 이름 + 상태칩 */}
              <div className="flex justify-between items-start gap-2 mb-2">
                <div>
                  <h3 className="font-semibold text-base">{record.worker_name || '이름없음'}</h3>
                  <p className="text-xs text-gray-500">{record.worker_phone || '-'}</p>
                </div>
                {getStatusChip(record)}
              </div>

              {/* 시간 정보 */}
              <div className="flex items-center gap-4 text-sm mb-3">
                <div>
                  <span className="text-gray-400">출근 </span>
                  <span className="font-medium">{formatTime(record.check_in_time)}</span>
                </div>
                <div>
                  <span className="text-gray-400">퇴근 </span>
                  <span className="font-medium">{formatTime(record.check_out_time)}</span>
                </div>
                <div>
                  <span className="text-gray-400">시간 </span>
                  <span className="font-medium">{getWorkHours(record)}</span>
                </div>
              </div>

              {/* 액션 버튼 */}
              {(!record.check_in_time || (record.check_in_time && !record.check_out_time)) && (
                <div className="flex gap-2">
                  {!record.check_in_time && (
                    <button
                      onClick={() => handleCheckIn(record.id)}
                      className="flex-1 py-2 rounded-lg text-xs font-medium text-white"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      출근 처리
                    </button>
                  )}
                  {record.check_in_time && !record.check_out_time && (
                    <button
                      onClick={() => handleCheckOut(record.id)}
                      className="flex-1 py-2 rounded-lg text-xs font-medium"
                      style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
                    >
                      퇴근 처리
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <span className="text-2xl text-gray-400">📊</span>
          </div>
          <p className="empty-state-title">출석 기록이 없습니다</p>
          <p className="empty-state-desc">확정된 지원자가 있으면 여기에 표시됩니다</p>
        </div>
      )}
    </div>
  );
}
