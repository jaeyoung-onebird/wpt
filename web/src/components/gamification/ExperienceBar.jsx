import React from 'react';

const LEVEL_THRESHOLDS = [
  { level: 1, required_exp: 0 },
  { level: 2, required_exp: 100 },
  { level: 3, required_exp: 300 },
  { level: 4, required_exp: 700 },
  { level: 5, required_exp: 1500 },
  { level: 6, required_exp: 3000 },
  { level: 7, required_exp: 5000 },
];

export default function ExperienceBar({ currentExp, level }) {
  // 현재 레벨과 다음 레벨의 경험치 구간 계산
  const currentLevelData = LEVEL_THRESHOLDS.find((l) => l.level === level) || LEVEL_THRESHOLDS[0];
  const nextLevelData = LEVEL_THRESHOLDS.find((l) => l.level === level + 1);

  if (!nextLevelData) {
    // 최고 레벨
    return (
      <div className="w-full">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">MAX LEVEL</span>
          <span className="text-sm font-bold text-primary">{currentExp} XP</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-yellow-400 to-orange-500 h-3 rounded-full transition-all duration-500"
            style={{ width: '100%' }}
          ></div>
        </div>
      </div>
    );
  }

  const currentLevelExp = currentLevelData.required_exp;
  const nextLevelExp = nextLevelData.required_exp;
  const expInCurrentLevel = currentExp - currentLevelExp;
  const expNeededForNextLevel = nextLevelExp - currentLevelExp;
  const progressPercentage = (expInCurrentLevel / expNeededForNextLevel) * 100;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">
          Level {level} → Level {level + 1}
        </span>
        <span className="text-sm font-bold text-primary">
          {expInCurrentLevel} / {expNeededForNextLevel} XP
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className="bg-gradient-to-r from-blue-500 to-primary h-3 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(progressPercentage, 100)}%` }}
        ></div>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        다음 레벨까지 {expNeededForNextLevel - expInCurrentLevel} XP 필요
      </p>
    </div>
  );
}
