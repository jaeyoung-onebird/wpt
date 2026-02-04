import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import LevelBadge from '../components/gamification/LevelBadge';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Leaderboard() {
  const { user } = useAuth();
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/gamification/leaderboard`);
      setRankings(response.data.rankings);

      // 내 순위 찾기
      if (user) {
        const myIndex = response.data.rankings.findIndex(
          (r) => r.worker_id === user.id
        );
        if (myIndex !== -1) {
          setMyRank(myIndex + 1);
        }
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">리더보드</h1>
        <p className="text-sm text-gray-600 mt-1">
          상위 근무자들의 레벨과 성과를 확인하세요
        </p>
      </div>

      {myRank && (
        <div className="bg-primary bg-opacity-10 border-2 border-primary rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-gray-700">내 순위</p>
          <p className="text-2xl font-bold text-primary">{getRankBadge(myRank)} {myRank}위</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="divide-y divide-gray-200">
          {rankings.map((worker, index) => {
            const rank = index + 1;
            const isMe = user && worker.worker_id === user.id;

            return (
              <div
                key={worker.worker_id}
                className={`p-4 flex items-center gap-4 hover:bg-gray-50 transition ${
                  isMe ? 'bg-blue-50' : ''
                }`}
              >
                {/* 순위 */}
                <div className="w-12 text-center">
                  <span className="text-2xl font-bold">{getRankBadge(rank)}</span>
                </div>

                {/* 근무자 정보 */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-gray-900">{worker.name}</p>
                    {isMe && (
                      <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">
                        나
                      </span>
                    )}
                  </div>
                  <LevelBadge level={worker.level} size="sm" />
                </div>

                {/* 통계 */}
                <div className="text-right">
                  <p className="text-sm text-gray-600">총 WPT</p>
                  <p className="text-lg font-bold text-primary">{worker.total_wpt_earned}</p>
                </div>

                <div className="text-right">
                  <p className="text-sm text-gray-600">경험치</p>
                  <p className="text-lg font-bold text-gray-700">{worker.experience_points}</p>
                </div>

                <div className="text-right">
                  <p className="text-sm text-gray-600">연속 출석</p>
                  <p className="text-lg font-bold text-orange-600">
                    {worker.current_streak || 0}🔥
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {rankings.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">아직 리더보드 데이터가 없습니다.</p>
        </div>
      )}
    </div>
  );
}
