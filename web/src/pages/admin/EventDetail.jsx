import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { eventsAPI, adminAPI, workersAPI, attendanceAPI } from '../../api/client';
import { formatDateTime, formatTime } from '../../utils/format';

export default function AdminEventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('applications');
  const [copied, setCopied] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 출퇴근 관리
  const [confirmedWorkers, setConfirmedWorkers] = useState([]);
  const [loadingConfirmed, setLoadingConfirmed] = useState(false);
  const [showOnlyInRange, setShowOnlyInRange] = useState(false);

  // 근무자 정보 모달
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [workerDetails, setWorkerDetails] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [eventRes, appsRes] = await Promise.all([
        eventsAPI.getDetail(id),
        adminAPI.getEventApplications(id),
      ]);
      setEvent(eventRes.data);
      setApplications(appsRes.data.applications || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (appId, status, reason = null) => {
    try {
      await adminAPI.updateApplicationStatus(appId, { status, rejection_reason: reason });
      loadData();
    } catch (error) {
      alert(error.response?.data?.detail || '처리에 실패했습니다');
    }
  };

  const handleConfirm = (appId) => {
    if (confirm('이 지원자를 확정하시겠습니까?')) {
      handleStatusChange(appId, 'CONFIRMED');
    }
  };

  const handleReject = (appId) => {
    const reason = prompt('거절 사유를 입력하세요 (선택사항):');
    if (reason !== null) {
      handleStatusChange(appId, 'REJECTED', reason || null);
    }
  };

  const handleWaitlist = (appId) => {
    if (confirm('이 지원자를 대기명단에 추가하시겠습니까?')) {
      handleStatusChange(appId, 'WAITLIST');
    }
  };

  const handleCancelConfirm = (appId) => {
    if (confirm('확정을 취소하시겠습니까? 지원자는 다시 심사중 상태가 됩니다.')) {
      handleStatusChange(appId, 'PENDING');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      PENDING: <span className="chip-pending">심사중</span>,
      CONFIRMED: <span className="chip-confirmed">확정</span>,
      REJECTED: <span className="chip-rejected">불합격</span>,
      WAITLIST: <span className="chip-waitlist">대기</span>,
    };
    return badges[status] || null;
  };

  const formatPay = (amount) => {
    if (!amount) return '';
    return `${(amount / 10000).toFixed(0)}만원`;
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await eventsAPI.delete(id);
      navigate('/admin/events', { replace: true });
    } catch (error) {
      alert(error.response?.data?.detail || '삭제에 실패했습니다');
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleCopyShare = async () => {
    if (!event) return;

    // 공유용 텍스트 포맷
    const lines = [];
    lines.push(`[${event.title}]`);
    lines.push('');
    lines.push(`📅 ${event.event_date}`);
    if (event.start_time) {
      lines.push(`⏰ ${event.start_time}${event.end_time ? ` ~ ${event.end_time}` : ''}`);
    }
    lines.push(`📍 ${event.location}`);
    if (event.pay_amount) {
      lines.push(`💰 ${formatPay(event.pay_amount)}${event.pay_description ? ` (${event.pay_description})` : ''}`);
    }
    if (event.work_type) {
      lines.push(`💼 ${event.work_type}`);
    }
    if (event.dress_code) {
      lines.push(`👔 ${event.dress_code}`);
    }

    // 자격요건
    const requirements = [];
    if (event.requires_driver_license) requirements.push('운전면허');
    if (event.requires_security_cert) requirements.push('경호이수증');
    if (requirements.length > 0) {
      lines.push(`✅ ${requirements.join(', ')} 필요`);
    }

    // 담당자 정보
    if (event.manager_name || event.manager_phone) {
      lines.push('');
      if (event.manager_name && event.manager_phone) {
        lines.push(`📞 담당: ${event.manager_name} (${event.manager_phone})`);
      } else if (event.manager_name) {
        lines.push(`📞 담당: ${event.manager_name}`);
      } else if (event.manager_phone) {
        lines.push(`📞 연락처: ${event.manager_phone}`);
      }
    }

    lines.push('');
    lines.push(`👉 지원하기: ${window.location.origin}/events/${id}`);

    const shareText = lines.join('\n');

    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // 폴백: textarea 사용
      const textarea = document.createElement('textarea');
      textarea.value = shareText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 출퇴근 관리 functions
  const loadConfirmedWorkers = async () => {
    if (!id) return;
    setLoadingConfirmed(true);
    try {
      const { data } = await attendanceAPI.getConfirmedWorkers(id);
      setConfirmedWorkers(data.workers || []);
    } catch (error) {
      console.error('Failed to load confirmed workers:', error);
      setConfirmedWorkers([]);
    } finally {
      setLoadingConfirmed(false);
    }
  };

  const handleGPSCheckIn = async (applicationId, gpsLocation) => {
    if (!confirm('이 근무자를 출근 처리하시겠습니까?')) return;

    try {
      const latitude = gpsLocation ? gpsLocation.latitude : null;
      const longitude = gpsLocation ? gpsLocation.longitude : null;
      await attendanceAPI.adminCheckIn(applicationId, false, latitude, longitude);
      alert('출근 처리되었습니다');
      loadConfirmedWorkers();
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
      loadConfirmedWorkers();
    } catch (error) {
      alert(error.response?.data?.detail || '퇴근 처리에 실패했습니다');
    }
  };

  const handleManualCheckIn = async (applicationId) => {
    if (!confirm('이 근무자를 수동으로 출근 처리하시겠습니까?')) return;

    try {
      await attendanceAPI.adminCheckIn(applicationId, true);
      alert('출근 처리되었습니다');
      loadConfirmedWorkers();
    } catch (error) {
      alert(error.response?.data?.detail || '출근 처리에 실패했습니다');
    }
  };

  const handleManualCheckOut = async (attendanceId) => {
    if (!confirm('이 근무자를 수동으로 퇴근 처리하시겠습니까?')) return;

    try {
      await attendanceAPI.adminCheckOut(attendanceId, true);
      alert('퇴근 처리되었습니다');
      loadConfirmedWorkers();
    } catch (error) {
      alert(error.response?.data?.detail || '퇴근 처리에 실패했습니다');
    }
  };

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

  // Load confirmed workers when attendance tab is active
  useEffect(() => {
    if (tab === 'attendance' && id) {
      loadConfirmedWorkers();
    }
  }, [tab, id]);

  // 근무자 정보 조회
  const handleWorkerClick = async (workerId) => {
    try {
      const { data } = await workersAPI.get(workerId);
      setWorkerDetails(data);
      setShowWorkerModal(true);
    } catch (error) {
      console.error('Failed to load worker details:', error);
      alert('근무자 정보를 불러오는데 실패했습니다');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-4 text-center">
        <p style={{ color: 'var(--color-text-sub)' }}>행사를 찾을 수 없습니다</p>
      </div>
    );
  }

  const pendingCount = applications.filter((a) => a.status === 'PENDING').length;
  const confirmedCount = applications.filter((a) => a.status === 'CONFIRMED').length;
  const waitlistCount = applications.filter((a) => a.status === 'WAITLIST').length;

  return (
    <div className="p-4 space-y-4">
      {/* 헤더 */}
      <div className="pt-2 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-title)' }}>{event.title}</h1>
          <p className="mt-1" style={{ color: 'var(--color-text-sub)' }}>{event.event_date}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyShare}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: copied ? 'var(--color-primary-light)' : 'var(--color-bg)',
              color: copied ? 'var(--color-primary)' : 'var(--color-text-secondary)'
            }}
          >
            {copied ? '복사됨!' : '공유복사'}
          </button>
          <Link to={`/admin/events/${id}/edit`} className="font-medium" style={{ color: 'var(--color-primary)' }}>
            수정
          </Link>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="font-medium"
            style={{ color: 'var(--color-error)' }}
          >
            삭제
          </button>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-4 gap-2">
        <div className="card text-center py-3">
          <p className="text-xl font-bold" style={{ color: 'var(--color-text-title)' }}>{applications.length}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>총 지원</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xl font-bold" style={{ color: 'var(--color-warning)' }}>{pendingCount}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>심사중</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>{confirmedCount}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>확정</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xl font-bold" style={{ color: 'var(--color-secondary)' }}>{waitlistCount}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>대기</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <button
          onClick={() => setTab('applications')}
          className="flex-1 py-3 text-center font-medium text-sm"
          style={{
            color: tab === 'applications' ? 'var(--color-primary)' : 'var(--color-text-sub)',
            borderBottom: tab === 'applications' ? '2px solid var(--color-primary)' : 'none'
          }}
        >
          지원자 ({applications.length})
        </button>
        <button
          onClick={() => setTab('info')}
          className="flex-1 py-3 text-center font-medium text-sm"
          style={{
            color: tab === 'info' ? 'var(--color-primary)' : 'var(--color-text-sub)',
            borderBottom: tab === 'info' ? '2px solid var(--color-primary)' : 'none'
          }}
        >
          행사 정보
        </button>
        <button
          onClick={() => setTab('attendance')}
          className="flex-1 py-3 text-center font-medium text-sm"
          style={{
            color: tab === 'attendance' ? 'var(--color-primary)' : 'var(--color-text-sub)',
            borderBottom: tab === 'attendance' ? '2px solid var(--color-primary)' : 'none'
          }}
        >
          출퇴근 관리
        </button>
      </div>

      {/* 컨텐츠 */}
      {tab === 'attendance' ? (
        <div className="space-y-3">
          {loadingConfirmed ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
            </div>
          ) : confirmedWorkers.length > 0 ? (
            <>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-sm">확정 근무자</h3>
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
              {confirmedWorkers
                .filter(worker => !showOnlyInRange || worker.within_range)
                .map((worker) => {
                  const hasGPS = worker.gps_location;
                  const inRange = worker.within_range;
                  const useGPS = hasGPS && inRange;

                  return (
                    <div
                      key={worker.application_id}
                      className={`card ${inRange ? 'bg-green-50 border border-green-200' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4
                            className="font-medium text-sm cursor-pointer hover:text-blue-600 transition-colors"
                            onClick={() => handleWorkerClick(worker.worker_id)}
                          >
                            {worker.worker_name}
                          </h4>
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
                              <span className="text-gray-400">⚫ GPS 근무 범위 밖</span>
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
            </>
          ) : (
            <div className="card text-center py-10">
              <p style={{ color: 'var(--color-text-disabled)' }}>확정된 근무자가 없습니다</p>
            </div>
          )}
        </div>
      ) : tab === 'applications' ? (
        <div className="space-y-3">
          {applications.length > 0 ? (
            applications.map((app) => (
              <div key={app.id} className="card">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    {app.worker_photo ? (
                      <img
                        src={workersAPI.getPhotoUrlFromPath(app.worker_photo)}
                        alt={app.worker_name}
                        className="w-12 h-12 rounded-full object-cover cursor-pointer"
                        onClick={() => window.open(workersAPI.getPhotoUrlFromPath(app.worker_photo), '_blank')}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-12 h-12 rounded-full items-center justify-center ${app.worker_photo ? 'hidden' : 'flex'}`}
                      style={{ backgroundColor: 'var(--color-bg)' }}
                    >
                      <span className="text-lg">👤</span>
                    </div>
                    <div>
                      <h3 className="font-semibold" style={{ color: 'var(--color-text-title)' }}>{app.worker_name}</h3>
                      <p className="text-sm" style={{ color: 'var(--color-text-sub)' }}>{app.worker_phone}</p>
                    </div>
                  </div>
                  {getStatusBadge(app.status)}
                </div>

                <div className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                  <p>지원일: {formatDateTime(app.applied_at)}</p>
                  {app.worker_residence && <p>거주지: {app.worker_residence}</p>}
                </div>

                {app.status === 'PENDING' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleConfirm(app.id)}
                      className="flex-1 py-2 text-white rounded-lg text-sm font-medium"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      확정
                    </button>
                    <button
                      onClick={() => handleWaitlist(app.id)}
                      className="flex-1 py-2 text-white rounded-lg text-sm font-medium"
                      style={{ backgroundColor: 'var(--color-secondary)' }}
                    >
                      대기
                    </button>
                    <button
                      onClick={() => handleReject(app.id)}
                      className="flex-1 py-2 text-white rounded-lg text-sm font-medium"
                      style={{ backgroundColor: 'var(--color-error)' }}
                    >
                      거절
                    </button>
                  </div>
                )}

                {app.status === 'WAITLIST' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleConfirm(app.id)}
                      className="flex-1 py-2 text-white rounded-lg text-sm font-medium"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      확정
                    </button>
                    <button
                      onClick={() => handleReject(app.id)}
                      className="flex-1 py-2 text-white rounded-lg text-sm font-medium"
                      style={{ backgroundColor: 'var(--color-error)' }}
                    >
                      거절
                    </button>
                  </div>
                )}

                {app.status === 'CONFIRMED' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCancelConfirm(app.id)}
                      className="flex-1 py-2 text-white rounded-lg text-sm font-medium"
                      style={{ backgroundColor: 'var(--color-text-disabled)' }}
                    >
                      확정 취소
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="card text-center py-10">
              <p style={{ color: 'var(--color-text-disabled)' }}>지원자가 없습니다</p>
            </div>
          )}
        </div>
      ) : (
        <div className="card space-y-4">
          <div className="flex justify-between py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ color: 'var(--color-text-sub)' }}>장소</span>
            <span className="font-medium" style={{ color: 'var(--color-text)' }}>{event.location}</span>
          </div>
          {event.start_time && (
            <div className="flex justify-between py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-sub)' }}>시간</span>
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                {event.start_time}{event.end_time ? ` ~ ${event.end_time}` : ''}
              </span>
            </div>
          )}
          <div className="flex justify-between py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ color: 'var(--color-text-sub)' }}>급여</span>
            <span className="font-medium" style={{ color: 'var(--color-text)' }}>{formatPay(event.pay_amount)}</span>
          </div>
          {event.pay_description && (
            <div className="flex justify-between py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-sub)' }}>급여 설명</span>
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>{event.pay_description}</span>
            </div>
          )}
          {event.headcount && (
            <div className="flex justify-between py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-sub)' }}>모집 인원</span>
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>{event.headcount}명</span>
            </div>
          )}
          {event.work_type && (
            <div className="flex justify-between py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-sub)' }}>근무 유형</span>
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>{event.work_type}</span>
            </div>
          )}
          {event.dress_code && (
            <div className="flex justify-between py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-sub)' }}>복장</span>
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>{event.dress_code}</span>
            </div>
          )}
          <div className="flex justify-between py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ color: 'var(--color-text-sub)' }}>운전면허</span>
            <span className="font-medium" style={{ color: 'var(--color-text)' }}>{event.requires_driver_license ? '필수' : '불필요'}</span>
          </div>
          <div className="flex justify-between py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ color: 'var(--color-text-sub)' }}>경호이수증</span>
            <span className="font-medium" style={{ color: 'var(--color-text)' }}>{event.requires_security_cert ? '필수' : '불필요'}</span>
          </div>
          {event.manager_name && (
            <div className="flex justify-between py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ color: 'var(--color-text-sub)' }}>담당자</span>
              <span className="font-medium" style={{ color: 'var(--color-text)' }}>{event.manager_name}</span>
            </div>
          )}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-title)' }}>행사 삭제</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              "{event?.title}" 행사를 삭제하시겠습니까?
              {applications.length > 0 && (
                <span className="block mt-2 text-xs" style={{ color: 'var(--color-error)' }}>
                  * 이 행사에 {applications.length}건의 지원이 있습니다.
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--color-error)' }}
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 근무자 정보 모달 */}
      {showWorkerModal && workerDetails && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowWorkerModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 max-h-[80vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--color-bg-card)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-title)' }}>
                근무자 정보
              </h3>
              <button
                onClick={() => setShowWorkerModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* 사진 */}
            {workerDetails.photo && (
              <div className="flex justify-center mb-4">
                <img
                  src={workersAPI.getPhotoUrlFromPath(workerDetails.photo)}
                  alt={workerDetails.name}
                  className="w-24 h-24 rounded-full object-cover"
                  onClick={() => window.open(workersAPI.getPhotoUrlFromPath(workerDetails.photo), '_blank')}
                />
              </div>
            )}

            {/* 정보 */}
            <div className="space-y-3">
              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>이름</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {workerDetails.name}
                </span>
              </div>

              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>전화번호</span>
                <a
                  href={`tel:${workerDetails.phone}`}
                  className="text-sm font-medium"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {workerDetails.phone}
                </a>
              </div>

              {workerDetails.birth_date && (
                <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>생년월일</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    {workerDetails.birth_date}
                  </span>
                </div>
              )}

              {workerDetails.residence && (
                <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>거주지</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    {workerDetails.residence}
                  </span>
                </div>
              )}

              {workerDetails.bank_name && (
                <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>은행</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    {workerDetails.bank_name}
                  </span>
                </div>
              )}

              {workerDetails.account_number && (
                <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>계좌번호</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    {workerDetails.account_number}
                  </span>
                </div>
              )}

              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>운전면허</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {workerDetails.has_driver_license ? '있음' : '없음'}
                </span>
              </div>

              <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>경호이수증</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {workerDetails.has_security_cert ? '있음' : '없음'}
                </span>
              </div>
            </div>

            {/* 닫기 버튼 */}
            <button
              onClick={() => setShowWorkerModal(false)}
              className="w-full mt-6 py-2.5 rounded-xl text-sm font-medium"
              style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
