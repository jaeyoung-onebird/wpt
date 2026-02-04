import React from 'react';

const LEVEL_COLORS = {
  1: 'bg-gray-100 text-gray-700 border-gray-300',
  2: 'bg-green-100 text-green-700 border-green-300',
  3: 'bg-blue-100 text-blue-700 border-blue-300',
  4: 'bg-purple-100 text-purple-700 border-purple-300',
  5: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  6: 'bg-red-100 text-red-700 border-red-300',
  7: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-yellow-500',
};

const LEVEL_TITLES = {
  1: '신입',
  2: '일꾼',
  3: '숙련공',
  4: '베테랑',
  5: '프로',
  6: '마스터',
  7: '레전드',
};

export default function LevelBadge({ level, size = 'md' }) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2',
  };

  const colorClass = LEVEL_COLORS[level] || LEVEL_COLORS[1];
  const title = LEVEL_TITLES[level] || '신입';

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border-2 ${colorClass} ${sizeClasses[size]}`}
    >
      Lv.{level} {title}
    </span>
  );
}
