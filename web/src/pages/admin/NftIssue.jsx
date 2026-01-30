import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { nftAPI, eventsAPI } from '../../api/client';

const TEMPLATES = [
  { id: 'minimal', name: '미니멀', desc: '심플한 카드 스타일' },
  { id: 'medal', name: '메달', desc: '게임/성과 스타일' },
  { id: 'cert', name: '인증서', desc: '공식 문서 스타일' },
];

const GRADES = [
  { id: 'COMMON', name: '일반', color: 'bg-gray-500' },
  { id: 'RARE', name: '희귀', color: 'bg-blue-500' },
  { id: 'EPIC', name: '영웅', color: 'bg-purple-500' },
  { id: 'LEGENDARY', name: '전설', color: 'bg-yellow-500' },
];

const ICONS = ['🎖️', '🏆', '⭐', '🌟', '💫', '🎯', '🔥', '💎', '👑', '🎪'];

export default function NftIssue() {
  const { id: eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);

  // 배지 설정
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🎖️');
  const [grade, setGrade] = useState('RARE');
  const [template, setTemplate] = useState('cert');

  useEffect(() => {
    loadData();
  }, [eventId]);

  const loadData = async () => {
    try {
      const [eventRes, workersRes] = await Promise.all([
        eventsAPI.get(eventId),
        nftAPI.getEligibleWorkers(eventId)
      ]);

      setEvent(eventRes.data);
      setWorkers(workersRes.data.workers || []);

      // 기본 제목 설정
      if (eventRes.data.title) {
        setTitle(`${eventRes.data.title} 참여`);
        setDescription(`${eventRes.data.title}에 참여해주셔서 감사합니다`);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      if (error.response?.status === 400) {
        alert('종료된 이벤트만 NFT 발행이 가능합니다');
        navigate('/admin/events/completed');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleWorker = (workerId) => {
    setSelectedWorkers(prev =>
      prev.includes(workerId)
        ? prev.filter(id => id !== workerId)
        : [...prev, workerId]
    );
  };

  const selectAll = () => {
    const eligible = workers.filter(w => !w.has_project_badge).map(w => w.id);
    setSelectedWorkers(eligible);
  };

  const deselectAll = () => {
    setSelectedWorkers([]);
  };

  const handleIssue = async () => {
    if (selectedWorkers.length === 0) {
      alert('발급 대상 근무자를 선택해주세요');
      return;
    }

    if (!title.trim()) {
      alert('배지 제목을 입력해주세요');
      return;
    }

    if (!confirm(`${selectedWorkers.length}명에게 NFT 배지를 발급하시겠습니까?`)) {
      return;
    }

    setIssuing(true);
    try {
      const result = await nftAPI.issueProjectBadges(eventId, {
        title,
        description,
        icon,
        grade,
        template,
        worker_ids: selectedWorkers
      });

      alert(`${result.data.issued_count}개의 배지가 발급되었습니다!`);
      navigate('/admin/events/completed');
    } catch (error) {
      console.error('Failed to issue badges:', error);
      alert(error.response?.data?.detail || '배지 발급에 실패했습니다');
    } finally {
      setIssuing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const eligibleCount = workers.filter(w => !w.has_project_badge).length;

  return (
    <div className="p-6 max-w-4xl mx-auto pb-24">
      {/* 헤더 */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">NFT 배지 발행</h1>
          <p className="text-gray-600">{event?.title}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 왼쪽: 배지 설정 */}
        <div className="bg-white rounded-lg border p-5">
          <h2 className="font-semibold text-lg mb-4">배지 설정</h2>

          {/* 제목 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="예: 2024 신년 행사 참여"
            />
          </div>

          {/* 설명 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">설명 (선택)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              placeholder="예: 행사에 참여해주셔서 감사합니다"
            />
          </div>

          {/* 아이콘 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">아이콘</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((i) => (
                <button
                  key={i}
                  onClick={() => setIcon(i)}
                  className={`w-10 h-10 text-xl rounded-lg border-2 transition-all ${
                    icon === i
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          {/* 등급 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">등급</label>
            <div className="flex gap-2">
              {GRADES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGrade(g.id)}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    grade === g.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className={`inline-block w-2 h-2 rounded-full ${g.color} mr-1.5`}></span>
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          {/* 템플릿 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">템플릿</label>
            <div className="space-y-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplate(t.id)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    template === t.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 미리보기 */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500 mb-2">미리보기</div>
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
              <span className="text-3xl">{icon}</span>
              <div>
                <div className="font-medium">{title || '배지 제목'}</div>
                <div className="text-xs text-gray-500">
                  {GRADES.find(g => g.id === grade)?.name} | {TEMPLATES.find(t => t.id === template)?.name}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽: 근무자 선택 */}
        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">발급 대상 선택</h2>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
              >
                전체 선택
              </button>
              <button
                onClick={deselectAll}
                className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-50 rounded"
              >
                선택 해제
              </button>
            </div>
          </div>

          <div className="text-sm text-gray-500 mb-3">
            발급 가능: {eligibleCount}명 / 선택됨: {selectedWorkers.length}명
          </div>

          {/* 근무자 목록 */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {workers.map((worker) => {
              const isSelected = selectedWorkers.includes(worker.id);
              const alreadyHasBadge = worker.has_project_badge;

              return (
                <div
                  key={worker.id}
                  onClick={() => !alreadyHasBadge && toggleWorker(worker.id)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    alreadyHasBadge
                      ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                      : isSelected
                        ? 'border-blue-500 bg-blue-50 cursor-pointer'
                        : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* 체크박스 */}
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                      alreadyHasBadge
                        ? 'border-gray-300 bg-gray-200'
                        : isSelected
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300'
                    }`}>
                      {(isSelected || alreadyHasBadge) && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>

                    {/* 근무자 정보 */}
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{worker.name}</div>
                      <div className="text-xs text-gray-500">{worker.phone}</div>
                    </div>

                    {/* 상태 */}
                    {alreadyHasBadge && (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-600 rounded-full">
                        발급 완료
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {workers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">👥</div>
              <div>출퇴근 완료한 근무자가 없습니다</div>
            </div>
          )}
        </div>
      </div>

      {/* 하단 고정 발급 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-blue-600">{selectedWorkers.length}명</span>
            에게 발급됩니다
          </div>
          <button
            onClick={handleIssue}
            disabled={issuing || selectedWorkers.length === 0}
            className={`px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
              issuing || selectedWorkers.length === 0
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {issuing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                발급 중...
              </span>
            ) : (
              'NFT 배지 발급'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
