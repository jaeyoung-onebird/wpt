import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import LevelBadge from './LevelBadge';
import ExperienceBar from './ExperienceBar';
import StreakDisplay from './StreakDisplay';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function GamificationStats({ workerId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (workerId) {
      fetchStats();
    }
  }, [workerId]);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/gamification/me/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch gamification stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-20 bg-gray-200 rounded mb-4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!stats || !stats.metrics) {
    return null;
  }

  const { metrics, streak, level_info } = stats;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">내 성장 현황</h2>
        <Link
          to="/leaderboard"
          className="text-sm text-primary hover:underline font-medium"
        >
          리더보드 보기 →
        </Link>
      </div>

      {/* 레벨 & 경험치 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <LevelBadge level={metrics.level} size="lg" />
          <div className="text-right">
            <p className="text-xs text-gray-600">총 WPT 획득</p>
            <p className="text-xl font-bold text-primary">{metrics.total_wpt_earned || 0} WPT</p>
          </div>
        </div>
        <ExperienceBar
          currentExp={metrics.experience_points}
          level={metrics.level}
        />
      </div>

      {/* 연속 출석 */}
      {streak && (
        <div className="mb-4">
          <StreakDisplay
            currentStreak={streak.current_streak || 0}
            longestStreak={streak.longest_streak || 0}
          />
        </div>
      )}

      {/* 추가 통계 */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-200">
        <div className="text-center">
          <p className="text-xs text-gray-600 mb-1">완료한 행사</p>
          <p className="text-lg font-bold text-gray-900">{metrics.completed_events || 0}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-600 mb-1">WPT 잔액</p>
          <p className="text-lg font-bold text-primary">{metrics.wpt_balance || 0}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-600 mb-1">신뢰도</p>
          <p className="text-lg font-bold text-green-600">
            {metrics.reliability_score?.toFixed(1) || '0.0'}
          </p>
        </div>
      </div>

      {level_info && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-700 font-medium">
            💡 {level_info.title} 혜택: {level_info.benefits || '기본 혜택'}
          </p>
        </div>
      )}
    </div>
  );
}
