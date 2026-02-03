import { useState, useEffect } from 'react';
import { adminAPI, eventsAPI, attendanceAPI } from '../../api/client';
import { formatTime, calculateWorkHours } from '../../utils/format';

export default function AdminAttendance() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);

  // GPS 기반 출퇴근 관리
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'manage'
  const [confirmedWorkers, setConfirmedWorkers] = useState([]);
  const [loadingConfirmed, setLoadingConfirmed] = useState(false);
  const [showOnlyInRange, setShowOnlyInRange] = useState(false);

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

    // 출퇴근 관리 탭이 활성화되어 있으면 확정 근무자도 로드
    if (activeTab === 'manage') {
      loadConfirmedWorkers(event.id);
    }
  };

  const loadConfirmedWorkers = async (eventId) => {
    setLoadingConfirmed(true);
    try {
      const { data } = await attendanceAPI.getConfirmedWorkers(eventId);
      setConfirmedWorkers(data.workers || []);
    } catch (error) {
      console.error('Failed to load confirmed workers:', error);
      setConfirmedWorkers([]);
    } finally {
      setLoadingConfirmed(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'manage' && selectedEvent) {
      loadConfirmedWorkers(selectedEvent.id);
    }
  };

  const handleGPSCheckIn = async (applicationId, gpsLocation) => {
    if (!confirm('이 근무자를 출근 처리하시겠습니까?')) return;

    try {
      const latitude = gpsLocation ? gpsLocation.latitude : null;
      const longitude = gpsLocation ? gpsLocation.longitude : null;
      await attendanceAPI.adminCheckIn(applicationId, false, latitude, longitude);
      alert('출근 처리되었습니다');
      loadConfirmedWorkers(selectedEvent.id);
      selectEvent(selectedEvent);
    } catch (error) {
      alert(error.response?.data?.detail || '출근 처리에 실패했습니다');
    }
  };

  const handleGPSCheckOut = async (attendanceId, gpsLocation) => {
    if (!confirm('이 근무자를 퇴근 처리하시겠습니까?')) return;

    try {
      const latitude = gpsLocation ? gpsLocation.latitude : null;
      const longitude = gpsLocation ? gpsLocation.longitude : null;
      await attendanceAPI.adminCheckOut(attendanceId, false, latitude, longitude);
      alert('퇴근 처리되었습니다');
      loadConfirmedWorkers(selectedEvent.id);
      selectEvent(selectedEvent);
    } catch (error) {
      alert(error.response?.data?.detail || '퇴근 처리에 실패했습니다');
    }
  };

  const handleManualCheckIn = async (applicationId) => {
    if (!confirm('이 근무자를 수동으로 출근 처리하시겠습니까?')) return;

    try {
      await attendanceAPI.adminCheckIn(applicationId, true);
      alert('출근 처리되었습니다');
      if (activeTab === 'manage') {
        loadConfirmedWorkers(selectedEvent.id);
      }
      selectEvent(selectedEvent);
    } catch (error) {
      alert(error.response?.data?.detail || '출근 처리에 실패했습니다');
    }
  };

  const handleManualCheckOut = async (attendanceId) => {
    if (!confirm('이 근무자를 수동으로 퇴근 처리하시겠습니까?')) return;

    try {
      await attendanceAPI.adminCheckOut(attendanceId, true);
      alert('퇴근 처리되었습니다');
      if (activeTab === 'manage') {
        loadConfirmedWorkers(selectedEvent.id);
      }
      selectEvent(selectedEvent);
    } catch (error) {
      alert(error.response?.data?.detail || '퇴근 처리에 실패했습니다');
    }
  };

  const handleCheckIn = async (attendanceId) => {
    // Find the attendance record to get application_id
    const record = attendance.find(a => a.id === attendanceId);
    if (!record) return;

    await handleManualCheckIn(record.application_id);
  };

  const handleCheckOut = async (attendanceId) => {
    await handleManualCheckOut(attendanceId);
  };

  // 스마트 출퇴근 처리 (GPS 우선, 없으면 수동)
  const handleSmartCheckIn = async (worker) => {
    const useGPS = worker.gps_location && worker.within_range;

    if (useGPS) {
      await handleGPSCheckIn(worker.application_id, worker.gps_location);
    } else {
      await handleManualCheckIn(worker.application_id);
    }
  };

  const handleSmartCheckOut = async (worker) => {
    const useGPS = worker.gps_location && worker.within_range;

    if (useGPS) {
      await handleGPSCheckOut(worker.attendance_id, worker.gps_location);
    } else {
      await handleManualCheckOut(worker.attendance_id);
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

      {/* 탭 전환 */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => handleTabChange('list')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'list'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          출석 목록
        </button>
        <button
          onClick={() => handleTabChange('manage')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'manage'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          출퇴근 관리
        </button>
      </div>

      {/* 출석 목록 탭 */}
      {activeTab === 'list' && (
        <>
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
        </>
      )}

      {/* 출퇴근 관리 탭 */}
      {activeTab === 'manage' && selectedEvent && (
        <>
          {/* 확정 근무자 목록 */}
          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-base">확정 근무자</h3>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={showOnlyInRange}
                  onChange={(e) => setShowOnlyInRange(e.target.checked)}
                  className="rounded"
                />
                범위 내만 표시
              </label>
            </div>
            {loadingConfirmed ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
              </div>
            ) : confirmedWorkers.length > 0 ? (
              <div className="space-y-2">
                {confirmedWorkers
                  .filter(worker => !showOnlyInRange || worker.within_range)
                  .map((worker) => {
                    const hasGPS = worker.gps_location;
                    const inRange = worker.within_range;
                    const useGPS = hasGPS && inRange;

                    return (
                      <div
                        key={worker.application_id}
                        className={`p-3 rounded-lg ${
                          inRange ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{worker.worker_name}</h4>
                            <p className="text-xs text-gray-500">{worker.worker_phone}</p>

                            {/* GPS 상태 */}
                            <div className="mt-1 flex gap-3 text-xs">
                              {hasGPS ? (
                                <>
                                  {inRange ? (
                                    <span className="text-green-600 font-medium">
                                      📍 범위 내 ({worker.distance_meters}m)
                                    </span>
                                  ) : (
                                    <span className="text-orange-600">
                                      📍 범위 밖 ({worker.distance_meters}m)
                                    </span>
                                  )}
                                  <span className="text-gray-500">
                                    🕐 {new Date(worker.gps_location.updated_at).toLocaleTimeString('ko-KR')}
                                  </span>
                                </>
                              ) : (
                                <span className="text-gray-400">⚫ GPS 없음</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 출퇴근 상태 및 버튼 */}
                        <div className="flex gap-2 mt-2">
                          {worker.check_out_time ? (
                            <div className="flex-1 py-2 px-3 bg-gray-100 rounded-lg text-center">
                              <span className="text-xs font-medium text-gray-600">✓ 퇴근완료</span>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {formatTime(worker.check_in_time)} ~ {formatTime(worker.check_out_time)}
                              </div>
                            </div>
                          ) : worker.check_in_time ? (
                            <>
                              <div className="flex-1 py-2 px-3 bg-blue-50 rounded-lg">
                                <span className="text-xs font-medium text-blue-600">✓ 근무중</span>
                                <div className="text-xs text-blue-500 mt-0.5">
                                  출근: {formatTime(worker.check_in_time)}
                                </div>
                              </div>
                              <button
                                onClick={() => handleSmartCheckOut(worker)}
                                className="px-4 py-2 rounded-lg text-xs font-medium text-white"
                                style={{ backgroundColor: 'var(--color-primary)' }}
                              >
                                퇴근 처리
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleSmartCheckIn(worker)}
                              className="flex-1 py-2 rounded-lg text-xs font-medium text-white"
                              style={{ backgroundColor: 'var(--color-primary)' }}
                            >
                              {useGPS ? '출근 처리' : '수동 출근'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-gray-500">
                확정된 근무자가 없습니다
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
