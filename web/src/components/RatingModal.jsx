import { useState } from 'react';
import { bigdataAPI } from '../api/client';

export default function RatingModal({ attendanceId, workerName, onClose, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      alert('별점을 선택해주세요');
      return;
    }

    setSubmitting(true);
    try {
      await bigdataAPI.createRating(attendanceId, { rating, feedback });
      alert('평가가 등록되었습니다');
      onSubmit && onSubmit();
      onClose();
    } catch (err) {
      alert(err.response?.data?.detail || '평가 등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const ratingLabels = ['', '매우 불만족', '불만족', '보통', '만족', '매우 만족'];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-title)' }}>
            근무 평가
          </h2>
          {workerName && (
            <p className="text-sm" style={{ color: 'var(--color-text-sub)' }}>
              {workerName}님 평가
            </p>
          )}
        </div>

        {/* 별점 */}
        <div className="p-6">
          <div className="flex justify-center gap-2 mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="transition-transform hover:scale-110"
              >
                <svg
                  className="w-10 h-10"
                  fill={(hoverRating || rating) >= star ? '#FBBF24' : 'none'}
                  stroke="#FBBF24"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                  />
                </svg>
              </button>
            ))}
          </div>
          <p className="text-center text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
            {rating > 0 ? ratingLabels[rating] : '별점을 선택하세요'}
          </p>
        </div>

        {/* 피드백 */}
        <div className="px-4 pb-4">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="한줄 평가 (선택사항)"
            rows={3}
            className="w-full p-3 border rounded-xl text-sm resize-none"
            style={{ borderColor: 'var(--color-border)' }}
          />
        </div>

        {/* 버튼 */}
        <div className="p-4 flex gap-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-medium"
            style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-sub)' }}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="flex-1 py-3 rounded-xl font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {submitting ? '등록 중...' : '평가 등록'}
          </button>
        </div>
      </div>
    </div>
  );
}
