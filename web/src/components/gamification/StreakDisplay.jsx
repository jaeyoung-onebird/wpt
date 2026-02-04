import React from 'react';

export default function StreakDisplay({ currentStreak, longestStreak }) {
  return (
    <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-4 border-2 border-orange-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🔥</span>
          <div>
            <p className="text-xs text-gray-600 font-medium">연속 출석</p>
            <p className="text-2xl font-bold text-orange-600">{currentStreak}일</p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs text-gray-600 font-medium">최고 기록</p>
          <p className="text-lg font-bold text-gray-700">{longestStreak}일</p>
        </div>
      </div>

      {currentStreak >= 3 && (
        <div className="mt-3 pt-3 border-t border-orange-200">
          <p className="text-xs text-orange-700 font-medium">
            ⭐ 3일 연속 출석! 다음 출근 시 +{Math.floor(currentStreak / 3) * 5} WPT 보너스
          </p>
        </div>
      )}

      {currentStreak === 0 && (
        <div className="mt-3 pt-3 border-t border-orange-200">
          <p className="text-xs text-gray-600">
            매일 출근하고 연속 출석 보너스를 받아보세요! (3일마다 +5 WPT)
          </p>
        </div>
      )}
    </div>
  );
}
