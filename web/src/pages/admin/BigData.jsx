import { useState, useEffect } from 'react';
import { bigdataAPI } from '../../api/client';

export default function BigData() {
  const [activeTab, setActiveTab] = useState('master');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 분석 요약 데이터
  const [summary, setSummary] = useState(null);

  // 마스터 데이터
  const [regions, setRegions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [skills, setSkills] = useState([]);

  // 필터
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  // 모달 상태
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // 폼 데이터
  const [regionForm, setRegionForm] = useState({ sido: '', sigungu: '' });
  const [categoryForm, setCategoryForm] = useState({ name: '', avg_pay: '' });
  const [skillForm, setSkillForm] = useState({ name: '', category: '자격증' });

  // 시도 목록
  const sidoList = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

  useEffect(() => {
    loadData();
  }, [activeTab, year, month]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'summary') {
        const res = await bigdataAPI.getAnalyticsSummary(year, month);
        setSummary(res.data);
      } else if (activeTab === 'master') {
        const [regRes, catRes, skillRes] = await Promise.all([
          bigdataAPI.getRegions(),
          bigdataAPI.getCategories(),
          bigdataAPI.getSkills()
        ]);
        setRegions(regRes.data.regions || []);
        setCategories(catRes.data.categories || []);
        setSkills(skillRes.data.skills || []);
      }
    } catch (err) {
      console.error('Load error:', err);
      setError(err.response?.data?.detail || '데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  // 지역 추가/수정
  const handleSaveRegion = async () => {
    if (!regionForm.sido || !regionForm.sigungu.trim()) {
      alert('시도와 시군구를 입력하세요');
      return;
    }
    try {
      const data = {
        sido: regionForm.sido,
        sigungu: regionForm.sigungu.trim()
      };
      if (editingItem) {
        await bigdataAPI.updateRegion(editingItem.id, data);
        alert('지역이 수정되었습니다');
      } else {
        await bigdataAPI.createRegion(data);
        alert('지역이 추가되었습니다');
      }
      setShowRegionModal(false);
      setRegionForm({ sido: '', sigungu: '' });
      setEditingItem(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || '저장 실패');
    }
  };

  // 지역 삭제
  const handleDeleteRegion = async (id, name) => {
    if (!confirm(`"${name}" 지역을 삭제하시겠습니까?`)) return;
    try {
      await bigdataAPI.deleteRegion(id);
      alert('삭제되었습니다');
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || '삭제 실패');
    }
  };

  // 업종 추가/수정
  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      alert('업종명을 입력하세요');
      return;
    }
    try {
      const data = {
        name: categoryForm.name,
        avg_pay: categoryForm.avg_pay ? parseInt(categoryForm.avg_pay) : null
      };
      if (editingItem) {
        await bigdataAPI.updateCategory(editingItem.id, data);
        alert('업종이 수정되었습니다');
      } else {
        await bigdataAPI.createCategory(data);
        alert('업종이 추가되었습니다');
      }
      setShowCategoryModal(false);
      setCategoryForm({ name: '', avg_pay: '' });
      setEditingItem(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || '저장 실패');
    }
  };

  // 업종 삭제
  const handleDeleteCategory = async (id, name) => {
    if (!confirm(`"${name}" 업종을 삭제하시겠습니까?`)) return;
    try {
      await bigdataAPI.deleteCategory(id);
      alert('삭제되었습니다');
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || '삭제 실패');
    }
  };

  // 기술/자격증 추가/수정
  const handleSaveSkill = async () => {
    if (!skillForm.name.trim()) {
      alert('기술/자격증명을 입력하세요');
      return;
    }
    try {
      const data = {
        name: skillForm.name,
        category: skillForm.category
      };
      if (editingItem) {
        await bigdataAPI.updateSkill(editingItem.id, data);
        alert('기술/자격증이 수정되었습니다');
      } else {
        await bigdataAPI.createSkill(data);
        alert('기술/자격증이 추가되었습니다');
      }
      setShowSkillModal(false);
      setSkillForm({ name: '', category: '자격증' });
      setEditingItem(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || '저장 실패');
    }
  };

  // 기술/자격증 삭제
  const handleDeleteSkill = async (id, name) => {
    if (!confirm(`"${name}"을(를) 삭제하시겠습니까?`)) return;
    try {
      await bigdataAPI.deleteSkill(id);
      alert('삭제되었습니다');
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || '삭제 실패');
    }
  };

  const handleBatchCalculate = async () => {
    if (!confirm(`${year}년 ${month}월 통계를 계산하시겠습니까?`)) return;
    try {
      setLoading(true);
      const res = await bigdataAPI.batchCalculateStats({ year, month });
      alert(res.data.message);
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || '배치 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCumulative = async () => {
    if (!confirm('전체 근무자의 누적 통계를 업데이트하시겠습니까?')) return;
    try {
      setLoading(true);
      const res = await bigdataAPI.batchUpdateCumulative();
      alert(res.data.message);
    } catch (err) {
      alert(err.response?.data?.detail || '업데이트 실패');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'master', label: '마스터 관리' },
    { id: 'summary', label: '분석 요약' },
    { id: 'batch', label: '배치 작업' },
  ];

  // 시도별 그룹핑
  const groupedRegions = regions.reduce((acc, r) => {
    if (!acc[r.sido]) acc[r.sido] = [];
    acc[r.sido].push(r);
    return acc;
  }, {});

  return (
    <div className="p-4 pb-24">
      {/* 헤더 */}
      <div className="mb-4">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-title)' }}>
          빅데이터 관리
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-sub)' }}>
          마스터 데이터 및 분석 관리
        </p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'text-white'
                : 'bg-gray-100'
            }`}
            style={activeTab === tab.id ? { backgroundColor: 'var(--color-primary)' } : { color: 'var(--color-text-sub)' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 기간 필터 (summary 탭) */}
      {activeTab === 'summary' && (
        <div className="flex gap-2 mb-4">
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {[2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-lg text-sm"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-primary)' }}></div>
        </div>
      ) : error ? (
        <div className="text-center py-10 text-red-500">{error}</div>
      ) : (
        <>
          {/* 마스터 관리 탭 */}
          {activeTab === 'master' && (
            <div className="space-y-4">
              {/* 지역 마스터 */}
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold" style={{ color: 'var(--color-text-title)' }}>지역 마스터</h3>
                      <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>
                        {regions.length}개 지역 등록됨
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingItem(null);
                        setRegionForm({ sido: '', sigungu: '' });
                        setShowRegionModal(true);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs text-white"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      + 추가
                    </button>
                  </div>
                </div>
                {regions.length > 0 ? (
                  <div className="p-4 max-h-80 overflow-y-auto">
                    {Object.entries(groupedRegions).sort().map(([sido, list]) => (
                      <div key={sido} className="mb-3">
                        <p className="text-xs font-bold mb-2" style={{ color: 'var(--color-text-title)' }}>
                          {sido} ({list.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {list.sort((a, b) => a.sigungu.localeCompare(b.sigungu)).map(r => (
                            <div
                              key={r.id}
                              className="group flex items-center gap-1 px-2 py-1 rounded text-xs"
                              style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
                            >
                              <span>{r.sigungu}</span>
                              <button
                                onClick={() => {
                                  setEditingItem(r);
                                  setRegionForm({ sido: r.sido, sigungu: r.sigungu });
                                  setShowRegionModal(true);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-blue-500 ml-1"
                              >
                                ✎
                              </button>
                              <button
                                onClick={() => handleDeleteRegion(r.id, `${r.sido} ${r.sigungu}`)}
                                className="opacity-0 group-hover:opacity-100 text-red-500"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center" style={{ color: 'var(--color-text-sub)' }}>
                    <p className="text-sm">등록된 지역이 없습니다</p>
                    <p className="text-xs mt-1">"+ 추가" 버튼을 눌러 지역을 등록하세요</p>
                  </div>
                )}
              </div>

              {/* 업종 마스터 */}
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold" style={{ color: 'var(--color-text-title)' }}>업종 마스터</h3>
                      <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>
                        {categories.length}개 업종 등록됨
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingItem(null);
                        setCategoryForm({ name: '', avg_pay: '' });
                        setShowCategoryModal(true);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs text-white"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      + 추가
                    </button>
                  </div>
                </div>
                {categories.length > 0 ? (
                  <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                    {categories.map(c => (
                      <div key={c.id} className="p-3 flex justify-between items-center">
                        <div>
                          <p className="font-medium text-sm" style={{ color: 'var(--color-text-title)' }}>{c.name}</p>
                          {c.avg_pay && (
                            <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>
                              평균 {(c.avg_pay / 10000).toFixed(0)}만원
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingItem(c);
                              setCategoryForm({ name: c.name, avg_pay: c.avg_pay || '' });
                              setShowCategoryModal(true);
                            }}
                            className="px-2 py-1 text-xs rounded"
                            style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-sub)' }}
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(c.id, c.name)}
                            className="px-2 py-1 text-xs rounded text-red-500"
                            style={{ backgroundColor: '#FEE2E2' }}
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center" style={{ color: 'var(--color-text-sub)' }}>
                    <p className="text-sm">등록된 업종이 없습니다</p>
                    <p className="text-xs mt-1">"+ 추가" 버튼을 눌러 업종을 등록하세요</p>
                  </div>
                )}
              </div>

              {/* 기술/자격증 마스터 */}
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold" style={{ color: 'var(--color-text-title)' }}>기술/자격증 마스터</h3>
                      <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>
                        {skills.length}개 항목 등록됨
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingItem(null);
                        setSkillForm({ name: '', category: '자격증' });
                        setShowSkillModal(true);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs text-white"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      + 추가
                    </button>
                  </div>
                </div>
                {skills.length > 0 ? (
                  <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                    {skills.map(s => (
                      <div key={s.id} className="p-3 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2 py-0.5 rounded text-xs"
                            style={{
                              backgroundColor: s.category === '자격증' ? '#FEF3C7' :
                                             s.category === '어학' ? '#DBEAFE' : '#E5E7EB',
                              color: s.category === '자격증' ? '#D97706' :
                                     s.category === '어학' ? '#2563EB' : '#4B5563'
                            }}
                          >
                            {s.category || '기타'}
                          </span>
                          <p className="font-medium text-sm" style={{ color: 'var(--color-text-title)' }}>{s.name}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingItem(s);
                              setSkillForm({ name: s.name, category: s.category || '자격증' });
                              setShowSkillModal(true);
                            }}
                            className="px-2 py-1 text-xs rounded"
                            style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-sub)' }}
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDeleteSkill(s.id, s.name)}
                            className="px-2 py-1 text-xs rounded text-red-500"
                            style={{ backgroundColor: '#FEE2E2' }}
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center" style={{ color: 'var(--color-text-sub)' }}>
                    <p className="text-sm">등록된 기술/자격증이 없습니다</p>
                    <p className="text-xs mt-1">"+ 추가" 버튼을 눌러 등록하세요</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 분석 요약 탭 */}
          {activeTab === 'summary' && summary && (
            <div className="space-y-4">
              {/* 핵심 지표 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-sub)' }}>총 행사</p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
                    {summary.total_events || 0}건
                  </p>
                </div>
                <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-sub)' }}>활동 근무자</p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--color-navy)' }}>
                    {summary.active_workers || 0}명
                  </p>
                </div>
                <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-sub)' }}>총 매출</p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--color-text-title)' }}>
                    {(summary.total_revenue || 0).toLocaleString()}원
                  </p>
                </div>
                <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-sub)' }}>완료율</p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>
                    {summary.completion_rate?.toFixed(1) || 0}%
                  </p>
                </div>
              </div>

              {/* 지역별 통계 */}
              {summary.by_region && summary.by_region.length > 0 && (
                <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                  <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <h3 className="font-bold" style={{ color: 'var(--color-text-title)' }}>지역별 현황</h3>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                    {summary.by_region.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="p-4 flex justify-between items-center">
                        <div>
                          <p className="font-medium" style={{ color: 'var(--color-text-title)' }}>
                            {item.region || '미지정'}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>
                            행사 {item.event_count}건 | 근무자 {item.worker_count}명
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold" style={{ color: 'var(--color-primary)' }}>
                            {(item.avg_pay || 0).toLocaleString()}원
                          </p>
                          <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>평균 급여</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 배치 작업 탭 */}
          {activeTab === 'batch' && (
            <div className="space-y-4">
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                <h3 className="font-bold mb-2" style={{ color: 'var(--color-text-title)' }}>월별 통계 계산</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--color-text-sub)' }}>
                  선택한 기간의 모든 근무자 통계를 계산합니다.
                </p>
                <div className="flex gap-2 mb-4">
                  <select
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                    className="px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    {[2024, 2025, 2026].map(y => (
                      <option key={y} value={y}>{y}년</option>
                    ))}
                  </select>
                  <select
                    value={month}
                    onChange={(e) => setMonth(parseInt(e.target.value))}
                    className="px-3 py-2 border rounded-lg text-sm"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{m}월</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleBatchCalculate}
                  disabled={loading}
                  className="w-full py-3 rounded-lg text-white font-medium"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {loading ? '계산 중...' : '통계 계산 실행'}
                </button>
              </div>

              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
                <h3 className="font-bold mb-2" style={{ color: 'var(--color-text-title)' }}>누적 통계 업데이트</h3>
                <p className="text-sm mb-4" style={{ color: 'var(--color-text-sub)' }}>
                  전체 근무자의 누적 근무 횟수, 시간, 신뢰도 점수 등을 업데이트합니다.
                </p>
                <button
                  onClick={handleUpdateCumulative}
                  disabled={loading}
                  className="w-full py-3 rounded-lg text-white font-medium"
                  style={{ backgroundColor: 'var(--color-navy)' }}
                >
                  {loading ? '업데이트 중...' : '누적 통계 업데이트'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 지역 추가/수정 모달 */}
      {showRegionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden">
            <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-title)' }}>
                {editingItem ? '지역 수정' : '지역 추가'}
              </h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-title)' }}>
                  시/도 *
                </label>
                <select
                  value={regionForm.sido}
                  onChange={(e) => setRegionForm({ ...regionForm, sido: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <option value="">선택하세요</option>
                  {sidoList.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-title)' }}>
                  시/군/구 *
                </label>
                <input
                  type="text"
                  value={regionForm.sigungu}
                  onChange={(e) => setRegionForm({ ...regionForm, sigungu: e.target.value })}
                  placeholder="예: 강남구"
                  className="w-full px-3 py-2 border rounded-lg"
                  style={{ borderColor: 'var(--color-border)' }}
                />
              </div>
            </div>
            <div className="p-4 flex gap-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <button
                onClick={() => {
                  setShowRegionModal(false);
                  setEditingItem(null);
                }}
                className="flex-1 py-2 rounded-lg"
                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-sub)' }}
              >
                취소
              </button>
              <button
                onClick={handleSaveRegion}
                className="flex-1 py-2 rounded-lg text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 업종 추가/수정 모달 */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden">
            <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-title)' }}>
                {editingItem ? '업종 수정' : '업종 추가'}
              </h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-title)' }}>
                  업종명 *
                </label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="예: 전시/박람회"
                  className="w-full px-3 py-2 border rounded-lg"
                  style={{ borderColor: 'var(--color-border)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-title)' }}>
                  평균 급여 (원)
                </label>
                <input
                  type="number"
                  value={categoryForm.avg_pay}
                  onChange={(e) => setCategoryForm({ ...categoryForm, avg_pay: e.target.value })}
                  placeholder="예: 130000"
                  className="w-full px-3 py-2 border rounded-lg"
                  style={{ borderColor: 'var(--color-border)' }}
                />
              </div>
            </div>
            <div className="p-4 flex gap-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingItem(null);
                }}
                className="flex-1 py-2 rounded-lg"
                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-sub)' }}
              >
                취소
              </button>
              <button
                onClick={handleSaveCategory}
                className="flex-1 py-2 rounded-lg text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 기술/자격증 추가/수정 모달 */}
      {showSkillModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden">
            <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-title)' }}>
                {editingItem ? '기술/자격증 수정' : '기술/자격증 추가'}
              </h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-title)' }}>
                  이름 *
                </label>
                <input
                  type="text"
                  value={skillForm.name}
                  onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })}
                  placeholder="예: 운전면허 1종"
                  className="w-full px-3 py-2 border rounded-lg"
                  style={{ borderColor: 'var(--color-border)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-title)' }}>
                  분류
                </label>
                <select
                  value={skillForm.category}
                  onChange={(e) => setSkillForm({ ...skillForm, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <option value="자격증">자격증</option>
                  <option value="어학">어학</option>
                  <option value="경험">경험</option>
                  <option value="기타">기타</option>
                </select>
              </div>
            </div>
            <div className="p-4 flex gap-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <button
                onClick={() => {
                  setShowSkillModal(false);
                  setEditingItem(null);
                }}
                className="flex-1 py-2 rounded-lg"
                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-sub)' }}
              >
                취소
              </button>
              <button
                onClick={handleSaveSkill}
                className="flex-1 py-2 rounded-lg text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
