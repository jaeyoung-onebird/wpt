import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { aiMatchingAPI } from '../api/client';
import MatchScoreCard from './MatchScoreCard';

/**
 * AI Recommendations Component
 * Displays AI-powered event recommendations for workers
 * with detailed match scores and breakdowns
 */
export default function AIRecommendations({ limit = 5, compact = false }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    loadRecommendations();
  }, [limit]);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await aiMatchingAPI.getRecommendedEvents(limit, 50);
      setRecommendations(data.recommendations || []);
    } catch (err) {
      console.error('Failed to load AI recommendations:', err);
      setError(err.response?.data?.detail || 'AI 추천을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-gray-600">AI가 최적의 행사를 찾고 있습니다...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-red-200">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">⚠️</span>
          <h3 className="font-bold text-lg text-gray-800">AI 추천 오류</h3>
        </div>
        <p className="text-gray-600 text-sm mb-4">{error}</p>
        <button
          onClick={loadRecommendations}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🤖</span>
          <h3 className="font-bold text-lg text-gray-800">AI 추천</h3>
        </div>
        <div className="text-center py-8">
          <span className="text-4xl mb-3 block">🔍</span>
          <p className="text-gray-600">현재 추천할 수 있는 행사가 없습니다</p>
          <p className="text-sm text-gray-500 mt-2">
            새로운 행사가 등록되면 AI가 자동으로 추천해드립니다
          </p>
        </div>
      </div>
    );
  }

  const displayCount = showAll || compact ? recommendations.length : Math.min(3, recommendations.length);
  const visibleRecommendations = recommendations.slice(0, displayCount);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.span
            className="text-2xl"
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          >
            🤖
          </motion.span>
          <div>
            <h3 className="font-bold text-lg text-gray-800">AI 맞춤 추천</h3>
            <p className="text-xs text-gray-600">
              {recommendations.length}개의 행사가 회원님과 매칭되었습니다
            </p>
          </div>
        </div>
        {!compact && recommendations.length > 3 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-primary font-medium hover:underline"
          >
            {showAll ? '접기' : `전체 보기 (${recommendations.length})`}
          </button>
        )}
      </div>

      {/* Recommendations List */}
      <AnimatePresence mode="popLayout">
        <div className="space-y-3">
          {visibleRecommendations.map((rec, index) => (
            <motion.div
              key={rec.event_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <MatchScoreCard recommendation={rec} rank={index + 1} compact={compact} />
            </motion.div>
          ))}
        </div>
      </AnimatePresence>

      {/* AI 정보 */}
      {!compact && (
        <motion.div
          className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl">💡</span>
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-gray-800 mb-1">
                AI 매칭은 어떻게 작동하나요?
              </h4>
              <p className="text-xs text-gray-700 leading-relaxed">
                거리, 신뢰도, 급여, 스킬, 가용성 등 5가지 요소를 분석하여
                회원님에게 가장 적합한 행사를 추천합니다. 매칭 점수가 높을수록
                더 적합한 행사입니다.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
