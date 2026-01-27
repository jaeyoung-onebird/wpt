import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { attendanceAPI } from '../api/client';
import { formatPay, safeNumber } from '../utils/format';

export default function WorkHistory() {
  const { worker } = useAuth();
  const [attendanceList, setAttendanceList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [downloading, setDownloading] = useState(false);

  // 회사 정보 (고정값)
  const companyInfo = {
    name: '(주)엘케이프라이빗',
    businessNumber: '635-86-01148',
    ceoName: '김재영',
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (worker) {
      loadAttendance();
    } else {
      setLoading(false);
    }
  }, [worker]);

  const loadAttendance = async () => {
    try {
      const { data } = await attendanceAPI.getMyList();
      // 퇴근완료된 기록만 필터링
      const completedRecords = (data.attendance || []).filter(
        (a) => a.check_out_time
      );
      setAttendanceList(completedRecords);
    } catch (error) {
      console.error('Failed to load attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  // 급여 계산 (프리랜서 3.3% 공제) - null/NaN 안전 처리
  const calculatePayment = (grossPay) => {
    const amount = safeNumber(grossPay, 0);
    const incomeTax = Math.floor(amount * 0.03); // 소득세 3%
    const localTax = Math.floor(amount * 0.003); // 지방소득세 0.3%
    const totalDeduction = incomeTax + localTax;
    const netPay = amount - totalDeduction;
    return { incomeTax, localTax, totalDeduction, netPay, grossPay: amount };
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[1]}월 ${parts[2]}일`;
    }
    return dateStr;
  };

  const formatBirthDate = (dateStr) => {
    if (!dateStr) return '-';
    // YYYY-MM-DD 형식에서 YYMMDD로 변환
    return dateStr.replace(/-/g, '').slice(2);
  };

  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return '-';
    return dateTimeStr.split('.')[0]; // 밀리초 제거
  };

  const getStatusText = (record) => {
    if (record.check_out_time) return '퇴근완료';
    if (record.check_in_time) return '출근완료';
    return '대기';
  };

  const handleDownloadPDF = async (record) => {
    setDownloading(true);
    try {
      const response = await attendanceAPI.downloadPaymentStatement(record.id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `지급명세서_${record.event_title}_${record.event_date}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert(error.response?.data?.detail || '다운로드에 실패했습니다');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="p-4 animate-fade-in">
        <div className="empty-state-modern card">
          <div className="empty-state-icon-modern">
            <span>👤</span>
          </div>
          <p className="empty-state-title-modern">회원등록이 필요해요</p>
          <p className="empty-state-desc-modern">
            업무이력을 확인하려면<br />
            먼저 프로필에서 등록을 완료하세요
          </p>
          <a href="/register" className="btn-cta-outline mt-2">
            회원등록 하러가기
          </a>
        </div>
      </div>
    );
  }

  // 통계 계산
  const stats = {
    total: attendanceList.length,
    pending: attendanceList.filter((a) => !a.check_in_time).length,
    checkedIn: attendanceList.filter((a) => a.check_in_time && !a.check_out_time).length,
    completed: attendanceList.filter((a) => a.check_out_time).length,
  };

  // 월별 그룹화 및 합계 계산
  const groupByMonth = (records) => {
    const groups = {};
    records.forEach((record) => {
      if (!record.event_date) return;
      const month = record.event_date.substring(0, 7); // YYYY-MM
      if (!groups[month]) {
        groups[month] = { records: [], grossTotal: 0, netTotal: 0 };
      }
      groups[month].records.push(record);
      const grossPay = record.pay_amount || 0;
      const { netPay } = calculatePayment(grossPay);
      groups[month].grossTotal += grossPay;
      groups[month].netTotal += netPay;
    });
    // 최신 월 순으로 정렬
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  };

  const monthlyGroups = groupByMonth(attendanceList);

  const formatMonth = (monthStr) => {
    const [year, month] = monthStr.split('-');
    return `${year}년 ${parseInt(month)}월`;
  };

  return (
    <div className="p-4 space-y-5 animate-fade-in">
      {/* 헤더 */}
      <div className="pt-1">
        <h1 className="text-xl font-bold text-gray-900">업무이력</h1>
        <p className="text-sm text-gray-500 mt-0.5">총 {stats.total}건</p>
      </div>

      {/* 통계 카드 */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)' }}>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-bold text-white">{stats.pending}</p>
            <p className="text-xs text-blue-200">대기</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{stats.checkedIn}</p>
            <p className="text-xs text-blue-200">출근완료</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{stats.completed}</p>
            <p className="text-xs text-blue-200">퇴근완료</p>
          </div>
        </div>
      </div>

      {/* 업무 이력 목록 (월별 그룹) */}
      <div>
        {monthlyGroups.length > 0 ? (
          <div className="space-y-4">
            {monthlyGroups.map(([month, data]) => (
              <div key={month}>
                {/* 월별 헤더 및 합계 */}
                <div className="mb-2">
                  <p className="section-title">{formatMonth(month)}</p>
                  <div className="card" style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' }}>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div>
                        <p className="text-lg font-bold text-white">{data.grossTotal.toLocaleString()}원</p>
                        <p className="text-xs text-amber-200">세전 총액</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white">{data.netTotal.toLocaleString()}원</p>
                        <p className="text-xs text-amber-200">세후 총액</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 해당 월 기록들 */}
                <div className="space-y-2">
                  {data.records.map((record) => (
                    <div
                      key={record.id}
                      className="card card-hover cursor-pointer"
                      onClick={() => setSelectedRecord(record)}
                    >
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <h3 className="font-semibold text-base">{record.event_title || '행사'}</h3>
                          <p className="text-xs text-gray-500">{formatDate(record.event_date)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {record.tx_hash && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">⛓️ 증명</span>
                          )}
                          <span className="chip-completed">{getStatusText(record)}</span>
                        </div>
                      </div>

                      {/* 급여 정보 미리보기 */}
                      {record.pay_amount && (
                        <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-gray-500">실지급액</span>
                          <span className="font-bold" style={{ color: 'var(--color-primary)' }}>
                            {calculatePayment(record.pay_amount).netPay.toLocaleString()}원
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state-modern card">
            <div className="empty-state-icon-modern">
              <span>📋</span>
            </div>
            <p className="empty-state-title-modern">아직 업무 이력이 없어요</p>
            <p className="empty-state-desc-modern">
              행사에 지원하고 출퇴근을 완료하면<br />
              여기서 이력을 확인할 수 있어요
            </p>
            <a href="/" className="btn-cta mt-2">
              행사 둘러보기
            </a>
          </div>
        )}
      </div>

      {/* 지급명세서 모달 */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            {/* 헤더 */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 text-white sticky top-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">💰</span>
                <span className="font-semibold">프리랜서 지급명세서</span>
              </div>
            </div>

            {/* 내용 */}
            <div className="p-5 space-y-4">
              {/* 근무자 정보 */}
              <div className="space-y-2">
                <div className="flex justify-between py-1">
                  <span className="text-gray-500 text-sm">이름</span>
                  <span className="font-medium">{worker.name}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500 text-sm">생년월일</span>
                  <span className="font-medium">{formatBirthDate(worker.birth_date)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500 text-sm">연락처</span>
                  <span className="font-medium">{worker.phone}</span>
                </div>
              </div>

              {/* 회사 정보 */}
              <div className="border-t border-gray-100 pt-4 space-y-2">
                <div className="flex justify-between py-1">
                  <span className="text-gray-500 text-sm">회사명</span>
                  <span className="font-medium">{companyInfo.name}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500 text-sm">사업자등록번호</span>
                  <span className="font-medium">{companyInfo.businessNumber}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500 text-sm">대표자명</span>
                  <span className="font-medium">{companyInfo.ceoName}</span>
                </div>
              </div>

              {/* 지급 정보 */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span>📋</span> 지급 정보
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500 text-sm">지급일</span>
                    <span className="font-medium">차주 수요일</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500 text-sm">용역 제공 기간</span>
                    <span className="font-medium">{selectedRecord.event_date} {selectedRecord.event_title}</span>
                  </div>
                </div>
              </div>

              {/* 지급 금액 */}
              {selectedRecord.pay_amount && (() => {
                const payment = calculatePayment(selectedRecord.pay_amount);
                return (
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <span>💵</span> 지급 금액
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between py-1">
                        <span className="text-gray-500 text-sm">지급총액</span>
                        <span className="font-medium">{selectedRecord.pay_amount.toLocaleString()}원</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-gray-500 text-sm">소득세(3%)</span>
                        <span className="font-medium text-red-500">-{payment.incomeTax.toLocaleString()}원</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-gray-500 text-sm">지방소득세(0.3%)</span>
                        <span className="font-medium text-red-500">-{payment.localTax.toLocaleString()}원</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-gray-500 text-sm">공제합계</span>
                        <span className="font-medium text-red-500">-{payment.totalDeduction.toLocaleString()}원</span>
                      </div>
                      <div className="flex justify-between py-2 bg-blue-50 rounded-lg px-3 mt-2">
                        <span className="font-semibold">실지급액</span>
                        <span className="font-bold text-lg" style={{ color: 'var(--color-primary)' }}>
                          {payment.netPay.toLocaleString()}원
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 근무 상태 */}
              <div className="border-t border-gray-100 pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500 text-sm">상태</span>
                    <span className="font-medium text-green-600">🎉 {getStatusText(selectedRecord)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500 text-sm">출근</span>
                    <span className="font-medium">{formatDateTime(selectedRecord.check_in_time)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500 text-sm">퇴근</span>
                    <span className="font-medium">{formatDateTime(selectedRecord.check_out_time)}</span>
                  </div>
                </div>
              </div>

              {/* 블록체인 증명 */}
              {selectedRecord.tx_hash && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span>⛓️</span> 블록체인 증명
                  </p>
                  <div className="bg-green-50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span className="text-sm text-green-700 font-medium">블록체인에 기록됨</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      <p>TX: {selectedRecord.tx_hash.slice(0, 16)}...{selectedRecord.tx_hash.slice(-8)}</p>
                      {selectedRecord.block_number && <p>Block: {selectedRecord.block_number}</p>}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`https://amoy.polygonscan.com/tx/${selectedRecord.tx_hash}`, '_blank');
                      }}
                      className="w-full py-2 text-xs bg-white text-green-700 border border-green-200 rounded-lg font-medium hover:bg-green-50"
                    >
                      Polygonscan에서 확인 →
                    </button>
                  </div>
                </div>
              )}

              {/* 버튼 */}
              <div className="space-y-2 pt-4">
                <button
                  onClick={() => handleDownloadPDF(selectedRecord)}
                  disabled={downloading}
                  className="w-full py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 disabled:bg-gray-300"
                >
                  {downloading ? '다운로드 중...' : '📄 지급명세서 PDF 다운로드'}
                </button>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
