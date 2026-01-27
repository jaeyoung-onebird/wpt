import { useState, useEffect } from 'react';
import { adminAPI } from '../../api/client';

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [workerData, setWorkerData] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [activeTab, setActiveTab] = useState('workscore');
  const [gradeFilter, setGradeFilter] = useState('all');

  useEffect(() => {
    window.scrollTo(0, 0);
    loadAllAnalytics();
  }, [period]);

  const loadAllAnalytics = async () => {
    setLoading(true);
    try {
      const [analyticsRes, workerRes, revenueRes] = await Promise.all([
        adminAPI.getAnalytics(period),
        adminAPI.getWorkerAnalytics(),
        adminAPI.getRevenueAnalytics(period)
      ]);
      setData(analyticsRes.data);
      setWorkerData(workerRes.data);
      setRevenueData(revenueRes.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString();
  };

  const formatMinutes = (minutes) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`;
  };

  const getGradeColor = (grade) => {
    const colors = {
      'S': '#FFD700',
      'A': '#22C55E',
      'B': '#3B82F6',
      'C': '#F59E0B',
      'D': '#EF4444',
      'N': '#9CA3AF'
    };
    return colors[grade] || '#9CA3AF';
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#FFD700';
    if (score >= 80) return '#22C55E';
    if (score >= 70) return '#3B82F6';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'workscore', label: 'WorkScore' },
    { id: 'revenue', label: '매출' },
    { id: 'summary', label: '요약' },
    { id: 'trends', label: '추이' },
  ];

  const filteredWorkers = workerData?.workers?.filter(w =>
    gradeFilter === 'all' || w.grade === gradeFilter
  ) || [];

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* 헤더 */}
      <div className="pt-2">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-title)' }}>분석 리포트</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-sub)' }}>
          {data?.generated_at ? new Date(data.generated_at).toLocaleString('ko-KR') : ''} 기준
        </p>
      </div>

      {/* 기간 선택 */}
      <div className="flex gap-2">
        {[
          { value: '7', label: '7일' },
          { value: '30', label: '30일' },
          { value: '90', label: '90일' },
          { value: 'all', label: '전체' },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setPeriod(opt.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              period === opt.value ? 'text-white' : ''
            }`}
            style={{
              backgroundColor: period === opt.value ? 'var(--color-primary)' : 'var(--color-bg-card)',
              color: period === opt.value ? 'white' : 'var(--color-text-secondary)'
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: 'var(--color-bg)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-white shadow-sm' : ''
            }`}
            style={{ color: activeTab === tab.id ? 'var(--color-text-title)' : 'var(--color-text-sub)' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* WorkScore 탭 */}
      {activeTab === 'workscore' && workerData && (
        <div className="space-y-4">
          {/* WorkScore 공식 카드 */}
          <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' }}>
            <p className="text-white font-semibold mb-2">WorkScore 공식</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                <span className="text-white/80">출근율 × 50%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                <span className="text-white/80">정시출근 × 20%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                <span className="text-white/80">무취소율 × 20%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                <span className="text-white/80">시간준수 × 10%</span>
              </div>
            </div>
          </div>

          {/* 전체 평균 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <p className="text-2xl font-bold" style={{ color: getScoreColor(workerData.averages?.work_score || 0) }}>
                {workerData.averages?.work_score || 0}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-sub)' }}>평균 점수</p>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>
                {workerData.averages?.attendance_rate || 0}%
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-sub)' }}>평균 출근율</p>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <p className="text-2xl font-bold" style={{ color: '#EF4444' }}>
                {workerData.averages?.no_show_rate || 0}%
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-sub)' }}>평균 노쇼율</p>
            </div>
          </div>

          {/* 등급별 분포 */}
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <p className="font-semibold" style={{ color: 'var(--color-text-title)' }}>등급별 분포</p>
            </div>
            <div className="p-4">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setGradeFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors`}
                  style={{
                    backgroundColor: gradeFilter === 'all' ? 'var(--color-primary)' : 'var(--color-bg)',
                    color: gradeFilter === 'all' ? 'white' : 'var(--color-text-secondary)'
                  }}
                >
                  전체 ({workerData.total_workers})
                </button>
                {Object.entries(workerData.grade_summary || {}).map(([grade, info]) => (
                  <button
                    key={grade}
                    onClick={() => setGradeFilter(grade)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1`}
                    style={{
                      backgroundColor: gradeFilter === grade ? getGradeColor(grade) : 'var(--color-bg)',
                      color: gradeFilter === grade ? 'white' : 'var(--color-text-secondary)'
                    }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getGradeColor(grade) }}></span>
                    {grade} ({info.count})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 근무자 목록 */}
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <p className="font-semibold" style={{ color: 'var(--color-text-title)' }}>
                근무자 WorkScore ({filteredWorkers.length}명)
              </p>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {filteredWorkers.length > 0 ? (
                filteredWorkers.map((worker, idx) => (
                  <div
                    key={worker.id}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: idx < filteredWorkers.length - 1 ? '1px solid var(--color-border)' : 'none' }}
                  >
                    {/* 등급 배지 */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm"
                      style={{ backgroundColor: getGradeColor(worker.grade) }}
                    >
                      {worker.grade}
                    </div>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate" style={{ color: 'var(--color-text-title)' }}>
                          {worker.name}
                        </p>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-sub)' }}>
                          {worker.completed}회
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: 'var(--color-text-sub)' }}>
                        <span>출근 {worker.attendance_rate}%</span>
                        <span>·</span>
                        <span>정시 {worker.on_time_rate}%</span>
                        {worker.no_show_rate > 0 && (
                          <>
                            <span>·</span>
                            <span style={{ color: '#EF4444' }}>노쇼 {worker.no_show_rate}%</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 점수 */}
                    <div className="text-right">
                      <p className="text-lg font-bold" style={{ color: getScoreColor(worker.work_score) }}>
                        {worker.work_score}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>
                        {worker.grade_label}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center" style={{ color: 'var(--color-text-disabled)' }}>
                  데이터가 없습니다
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 매출 탭 */}
      {activeTab === 'revenue' && revenueData && (
        <div className="space-y-4">
          {/* 매출 요약 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
                {formatNumber(revenueData.summary?.today_revenue)}원
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-sub)' }}>오늘 예상 매출</p>
            </div>
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>
                {formatNumber(revenueData.summary?.this_week_revenue)}원
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-sub)' }}>이번 주</p>
            </div>
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <p className="text-2xl font-bold" style={{ color: '#6366F1' }}>
                {formatNumber(revenueData.summary?.this_month_revenue)}원
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-sub)' }}>이번 달</p>
            </div>
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <p className="text-2xl font-bold" style={{ color: '#F59E0B' }}>
                {formatNumber(revenueData.summary?.total_estimated_revenue)}원
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-sub)' }}>전체 누적</p>
            </div>
          </div>

          {/* 월별 매출 */}
          {revenueData.monthly?.length > 0 && (
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-sub)' }}>월별 매출</p>
              <div className="space-y-3">
                {revenueData.monthly.slice(0, 6).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{item.month}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{formatNumber(item.estimated_revenue)}원</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-sub)' }}>
                        {item.events}건
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 유형별 매출 */}
          {revenueData.by_type?.length > 0 && (
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-sub)' }}>행사 유형별</p>
              <div className="space-y-3">
                {revenueData.by_type.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{item.work_type}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{formatNumber(item.estimated_revenue)}원</span>
                      <span className="text-xs" style={{ color: 'var(--color-text-sub)' }}>
                        (평균 {formatNumber(item.avg_pay)}원)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 지역별 매출 */}
          {revenueData.by_location?.length > 0 && (
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-sub)' }}>지역별</p>
              <div className="space-y-2">
                {revenueData.by_location.slice(0, 8).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1">
                    <span className="text-sm truncate flex-1" style={{ color: 'var(--color-text-secondary)' }}>
                      {item.location}
                    </span>
                    <span className="text-sm font-medium">{formatNumber(item.estimated_revenue)}원</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 요약 탭 */}
      {activeTab === 'summary' && data?.summary && (
        <div className="space-y-4">
          {/* 핵심 지표 카드 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <p className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>
                {formatNumber(data.summary.total_workers)}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-sub)' }}>총 근무자</p>
            </div>
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <p className="text-3xl font-bold" style={{ color: 'var(--color-success)' }}>
                {formatNumber(data.summary.total_events)}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-sub)' }}>총 행사</p>
            </div>
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <p className="text-3xl font-bold" style={{ color: '#6366F1' }}>
                {formatNumber(data.summary.total_applications)}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-sub)' }}>총 지원</p>
            </div>
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <p className="text-3xl font-bold" style={{ color: '#F59E0B' }}>
                {data.summary.approval_rate}%
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-sub)' }}>승인율</p>
            </div>
          </div>

          {/* 근무 통계 */}
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-sub)' }}>근무 통계</p>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>완료된 근무</span>
                <span className="font-medium">{formatNumber(data.summary.total_completed_work)}건</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>총 근무 시간</span>
                <span className="font-medium">{formatNumber(data.summary.total_worked_hours)}시간</span>
              </div>
              {data.work_time && (
                <>
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>평균 근무 시간</span>
                    <span className="font-medium">{formatMinutes(data.work_time.avg_minutes)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 급여 통계 */}
          {data.events?.pay_stats && (
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-sub)' }}>급여 통계</p>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>평균 급여</span>
                  <span className="font-medium">{formatNumber(data.events.pay_stats.avg_pay)}원</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>최소 급여</span>
                  <span className="font-medium">{formatNumber(data.events.pay_stats.min_pay)}원</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>최대 급여</span>
                  <span className="font-medium">{formatNumber(data.events.pay_stats.max_pay)}원</span>
                </div>
              </div>
            </div>
          )}

          {/* 지역별 근무자 */}
          {data.workers?.by_region?.length > 0 && (
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-sub)' }}>지역별 근무자</p>
              <div className="space-y-2">
                {data.workers.by_region.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-sm flex-1 truncate" style={{ color: 'var(--color-text-secondary)' }}>
                      {item.region}
                    </span>
                    <div className="w-24 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(item.count / data.summary.total_workers) * 100}%`,
                          backgroundColor: 'var(--color-primary)'
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">{item.count}명</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 추이 탭 */}
      {activeTab === 'trends' && data?.trends && (
        <div className="space-y-4">
          {/* 지원 상태 */}
          {data.applications?.by_status && (
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-sub)' }}>지원 현황</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center py-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
                  <p className="text-lg font-bold" style={{ color: '#F59E0B' }}>
                    {data.applications.by_status.PENDING || 0}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>대기중</p>
                </div>
                <div className="text-center py-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
                  <p className="text-lg font-bold" style={{ color: 'var(--color-success)' }}>
                    {data.applications.by_status.CONFIRMED || 0}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>승인</p>
                </div>
                <div className="text-center py-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg)' }}>
                  <p className="text-lg font-bold" style={{ color: '#EF4444' }}>
                    {data.applications.by_status.REJECTED || 0}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>거절</p>
                </div>
              </div>
            </div>
          )}

          {/* 일별 신규 등록 */}
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-sub)' }}>일별 신규 등록</p>
            {data.trends.daily_registrations?.length > 0 ? (
              <div className="h-32 flex items-end gap-1">
                {data.trends.daily_registrations.slice(-14).map((item, idx) => {
                  const maxCount = Math.max(...data.trends.daily_registrations.map(d => d.count));
                  const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-medium" style={{ color: 'var(--color-text-sub)' }}>{item.count}</span>
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${Math.max(height, 4)}%`,
                          backgroundColor: 'var(--color-primary)',
                          minHeight: '4px'
                        }}
                      />
                      <span className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
                        {item.date?.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center py-4" style={{ color: 'var(--color-text-disabled)' }}>데이터가 없습니다</p>
            )}
          </div>

          {/* 일별 지원 */}
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-sub)' }}>일별 지원</p>
            {data.trends.daily_applications?.length > 0 ? (
              <div className="h-32 flex items-end gap-1">
                {data.trends.daily_applications.slice(-14).map((item, idx) => {
                  const maxCount = Math.max(...data.trends.daily_applications.map(d => d.count));
                  const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-medium" style={{ color: 'var(--color-text-sub)' }}>{item.count}</span>
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${Math.max(height, 4)}%`,
                          backgroundColor: 'var(--color-success)',
                          minHeight: '4px'
                        }}
                      />
                      <span className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
                        {item.date?.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center py-4" style={{ color: 'var(--color-text-disabled)' }}>데이터가 없습니다</p>
            )}
          </div>

          {/* 시간대별 출근 */}
          {data.trends.checkin_by_hour?.length > 0 && (
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
              <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-sub)' }}>시간대별 출근</p>
              <div className="h-24 flex items-end gap-1">
                {data.trends.checkin_by_hour.map((item, idx) => {
                  const maxCount = Math.max(...data.trends.checkin_by_hour.map(d => d.count));
                  const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${Math.max(height, 4)}%`,
                          backgroundColor: '#6366F1',
                          minHeight: '4px'
                        }}
                      />
                      <span className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
                        {item.hour}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
