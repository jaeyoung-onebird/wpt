import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import LevelBadge from '../components/gamification/LevelBadge';
import { motion } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Leaderboard() {
  const { user } = useAuth();
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState(null);
  const [period, setPeriod] = useState('all'); // 'all' or 'monthly'

  useEffect(() => {
    fetchLeaderboard();
  }, [period]);

  const fetchLeaderboard = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/gamification/leaderboard`, {
        params: { period, limit: 50 }
      });
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
        <h1 className="text-2xl font-bold text-gray-900">🏆 리더보드</h1>
        <p className="text-sm text-gray-600 mt-1">
          상위 근무자들의 레벨과 성과를 확인하세요
        </p>
      </div>

      {/* 기간 필터 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setPeriod('all')}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold transition ${
            period === 'all'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          전체 기간
        </button>
        <button
          onClick={() => setPeriod('monthly')}
          className={`flex-1 py-2 px-4 rounded-lg font-semibold transition ${
            period === 'monthly'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          이번 달
        </button>
      </div>

      {myRank && (
        <motion.div
          className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-xl p-4 mb-4"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          <p className="text-sm font-medium text-gray-700">내 순위</p>
          <p className="text-3xl font-bold text-blue-600">{getRankBadge(myRank)} {myRank}위</p>
        </motion.div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="divide-y divide-gray-200">
          {rankings.map((worker, index) => {
            const rank = index + 1;
            const isMe = user && worker.worker_id === user.id;

            return (
              <motion.div
                key={worker.worker_id}
                className={`p-4 flex items-center gap-4 hover:bg-gray-50 transition rounded-lg ${
                  isMe ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300' : ''
                } ${rank <= 3 ? 'border-l-4 ' + (rank === 1 ? 'border-yellow-400' : rank === 2 ? 'border-gray-400' : 'border-orange-400') : ''}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                {/* 순위 */}
                <div className="w-14 text-center">
                  <span className="text-3xl font-bold">{getRankBadge(rank)}</span>
                </div>

                {/* 근무자 정보 */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-gray-900">{worker.name}</p>
                    {isMe && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-semibold">
                        나
                      </span>
                    )}
                  </div>
                  <LevelBadge level={worker.level} size="sm" />
                </div>

                {/* 통계 - 모바일 대응 */}
                <div className="hidden md:flex gap-6">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">총 WPT</p>
                    <p className="text-lg font-bold text-yellow-600">{worker.total_wpt_earned}</p>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">경험치</p>
                    <p className="text-lg font-bold text-gray-700">{worker.experience_points}</p>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Streak</p>
                    <p className="text-lg font-bold text-orange-600">
                      {worker.current_streak || 0}🔥
                    </p>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">완료</p>
                    <p className="text-lg font-bold text-green-600">{worker.completed_events || 0}</p>
                  </div>
                </div>

                {/* 모바일용 간단 통계 */}
                <div className="flex md:hidden flex-col text-right">
                  <span className="text-sm text-yellow-600 font-bold">{worker.total_wpt_earned} WPT</span>
                  <span className="text-xs text-gray-500">{worker.experience_points} EXP</span>
                </div>
              </motion.div>
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
