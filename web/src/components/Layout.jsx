import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// SVG 아이콘들 - 모두 outline 스타일, 활성화 시 두꺼운 선
const HomeIcon = ({ active }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
);

const ListIcon = ({ active }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
  </svg>
);

const ClockIcon = ({ active }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const UserIcon = ({ active }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);

const ChainIcon = ({ active }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
  </svg>
);

const AdminIcon = ({ active }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
  </svg>
);

export default function Layout() {
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.is_admin || user?.role === 'admin';

  // 관리자 페이지인지 확인
  const isAdminPage = location.pathname.startsWith('/admin');

  // 관리자와 일반 사용자 네비게이션 분리
  const navItems = isAdmin ? [
    { path: '/', icon: HomeIcon, label: '홈' },
    { path: '/admin/events', icon: ListIcon, label: '행사관리' },
    { path: '/admin/attendance', icon: ClockIcon, label: '출퇴근관리' },
    { path: '/profile', icon: UserIcon, label: '내정보' },
    { path: '/admin', icon: AdminIcon, label: '관리' },
  ] : user ? [
    // 로그인한 일반 사용자
    { path: '/', icon: HomeIcon, label: '홈' },
    { path: '/applications', icon: ListIcon, label: '지원' },
    { path: '/work-history', icon: ClockIcon, label: '업무이력' },
    { path: '/blockchain', icon: ChainIcon, label: '증명' },
    { path: '/profile', icon: UserIcon, label: '내정보' },
  ] : [
    // 비로그인 사용자 - 증명 탭 숨김
    { path: '/', icon: HomeIcon, label: '홈' },
    { path: '/applications', icon: ListIcon, label: '지원' },
    { path: '/work-history', icon: ClockIcon, label: '업무이력' },
    { path: '/profile', icon: UserIcon, label: '내정보' },
  ];

  return (
    <div
      className="min-h-screen pb-20"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* 관리자 페이지 배지 - 네이비 */}
      {isAdmin && isAdminPage && (
        <div className="text-xs text-center py-1.5 px-4 flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--color-navy)', color: 'white' }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          관리자 모드
        </div>
      )}

      {/* 메인 컨텐츠 - 반응형 */}
      <main className="max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl mx-auto">
        <Outlet />
      </main>

      {/* 하단 네비게이션 - 아이콘 + 텍스트 */}
      <nav className="fixed bottom-0 left-0 right-0 shadow-lg bg-white border-t border-gray-100">
        <div className="max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl mx-auto flex">
          {navItems.map(({ path, icon: Icon, label }) => {
            // 정확히 일치해야 하는 경로들 (하위 경로와 구분 필요)
            const exactMatchOnly = path === '/' || path === '/admin';
            const isActive = exactMatchOnly
              ? location.pathname === path
              : (location.pathname === path || location.pathname.startsWith(path));
            return (
              <Link
                key={path}
                to={path}
                className="flex-1 flex flex-col items-center py-2.5 transition-colors"
                style={{
                  color: isActive ? 'var(--color-primary)' : '#9CA3AF'
                }}
              >
                <Icon active={isActive} />
                <span className={`text-xs mt-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
        <div className="safe-bottom"></div>
      </nav>
    </div>
  );
}
