import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationsAPI } from '../api/client';

// SVG 아이콘들
const HomeIcon = ({ active }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
);

const WorkIcon = ({ active }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
  </svg>
);

const WalletIcon = ({ active }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
  </svg>
);

const CollectionIcon = ({ active }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
  </svg>
);

const CalendarIcon = ({ active }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);

const MyIcon = ({ active }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);

// 관리자용 아이콘
const AdminDashboardIcon = ({ active }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
  </svg>
);

const EventIcon = ({ active }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);

const TokenIcon = ({ active }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
  </svg>
);

const SettingsIcon = ({ active }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const BellIcon = ({ hasNotifications }) => (
  <div className="relative">
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
    {hasNotifications && (
      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full"></span>
    )}
  </div>
);

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, worker, logout } = useAuth();
  const isAdmin = user?.is_admin || user?.role === 'admin';

  // 관리자 모드 상태 (localStorage에 저장)
  const [adminMode, setAdminMode] = useState(() => {
    if (!isAdmin) return false;
    return localStorage.getItem('adminMode') === 'true';
  });

  // 프로필 드롭다운 상태
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // 알림 개수
  const [unreadCount, setUnreadCount] = useState(0);

  // 알림 개수 조회
  useEffect(() => {
    if (user) {
      loadUnreadCount();
    }
  }, [user]);

  const loadUnreadCount = async () => {
    try {
      const { data } = await notificationsAPI.getUnreadCount();
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  // 모드 토글
  const toggleAdminMode = () => {
    const newMode = !adminMode;
    setAdminMode(newMode);
    localStorage.setItem('adminMode', String(newMode));

    // 모드 전환 시 해당 홈으로 이동
    if (newMode) {
      navigate('/admin');
    } else {
      navigate('/');
    }
  };

  // 현재 관리자 페이지인지 확인
  const isAdminPage = location.pathname.startsWith('/admin');

  // 사용자 네비게이션 (새 구조)
  const userNavItems = [
    { path: '/', icon: HomeIcon, label: '홈' },
    { path: '/work', icon: WorkIcon, label: '내 근무' },
    { path: '/calendar', icon: CalendarIcon, label: '일정' },
    { path: '/wallet', icon: WalletIcon, label: '지갑' },
    { path: '/my', icon: MyIcon, label: 'MY' },
  ];

  // 관리자 네비게이션
  const adminNavItems = [
    { path: '/admin', icon: AdminDashboardIcon, label: '대시보드' },
    { path: '/admin/events', icon: EventIcon, label: '행사' },
    { path: '/admin/workers', icon: MyIcon, label: 'HR' },
    { path: '/admin/wpt', icon: TokenIcon, label: '토큰' },
    { path: '/admin/settings', icon: SettingsIcon, label: '설정' },
  ];

  // 현재 모드에 따른 네비게이션
  const navItems = (isAdmin && adminMode) ? adminNavItems : userNavItems;

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* 상단 헤더 */}
      <header className="sticky top-0 z-50 bg-white border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* 로고 */}
          <Link to={adminMode ? '/admin' : '/'} className="flex items-center gap-2">
            <span className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>WorkProof</span>
            {isAdmin && adminMode && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-navy)', color: 'white' }}>
                관리자
              </span>
            )}
          </Link>

          {/* 우측 메뉴 */}
          <div className="flex items-center gap-3">
            {/* 알림 버튼 */}
            {user && (
              <Link to="/notifications" className="p-2 rounded-full hover:bg-gray-100">
                <BellIcon hasNotifications={unreadCount > 0} />
              </Link>
            )}

            {/* 프로필 / 로그인 */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 p-1.5 rounded-full hover:bg-gray-100"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                    {worker?.face_photo_file_id ? (
                      <img
                        src={`/photos/${worker.face_photo_file_id.split('/').pop()}`}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <span className="text-sm">👤</span>
                    )}
                  </div>
                </button>

                {/* 드롭다운 메뉴 */}
                {showProfileMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowProfileMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border z-50" style={{ borderColor: 'var(--color-border)' }}>
                      <div className="p-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <p className="font-semibold" style={{ color: 'var(--color-text-title)' }}>
                          {worker?.name || '사용자'}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>
                          {user?.email}
                        </p>
                      </div>

                      {/* 관리자 모드 토글 */}
                      {isAdmin && (
                        <div className="p-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
                          <button
                            onClick={() => {
                              toggleAdminMode();
                              setShowProfileMenu(false);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50"
                          >
                            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                              {adminMode ? '👤 사용자 모드로 전환' : '🔧 관리자 모드로 전환'}
                            </span>
                            <div
                              className="w-10 h-6 rounded-full p-0.5 transition-colors"
                              style={{ backgroundColor: adminMode ? 'var(--color-navy)' : '#D1D5DB' }}
                            >
                              <div
                                className="w-5 h-5 rounded-full bg-white shadow transition-transform"
                                style={{ transform: adminMode ? 'translateX(16px)' : 'translateX(0)' }}
                              />
                            </div>
                          </button>
                        </div>
                      )}

                      <div className="p-2">
                        <Link
                          to="/my"
                          onClick={() => setShowProfileMenu(false)}
                          className="block px-3 py-2 rounded-lg hover:bg-gray-50 text-sm"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          ⚙️ 설정
                        </Link>
                        <button
                          onClick={() => {
                            logout();
                            setShowProfileMenu(false);
                            navigate('/login');
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 text-sm"
                          style={{ color: 'var(--color-error)' }}
                        >
                          🚪 로그아웃
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                로그인
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="max-w-2xl mx-auto">
        <Outlet />
      </main>

      {/* 하단 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 shadow-lg bg-white border-t border-gray-100">
        <div className="max-w-2xl mx-auto flex">
          {navItems.map(({ path, icon: Icon, label }) => {
            const exactMatchOnly = path === '/' || path === '/admin';
            const isActive = exactMatchOnly
              ? location.pathname === path
              : (location.pathname === path || location.pathname.startsWith(path + '/'));

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
