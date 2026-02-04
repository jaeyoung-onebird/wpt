import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// 레이아웃
import Layout from './components/Layout';

// 페이지
import Home from './pages/Home';
import Login from './pages/Login';
import EventDetail from './pages/EventDetail';
import Register from './pages/Register';
import Badges from './pages/Badges';
import BadgeDetail from './pages/BadgeDetail';

// 새 통합 페이지 (Work OS)
import WorkOS from './pages/WorkOS'; // 통합 Work 페이지
import Attendance from './pages/Attendance';
import History from './pages/History'; // 새 History 페이지 (WPT + NFT + 이력)
import My from './pages/My';
import Notifications from './pages/Notifications';

// 레거시 페이지 (리다이렉트용)
import Wallet from './pages/Wallet';
import Work from './pages/Work';
import Collection from './pages/Collection';
import CalendarPage from './pages/Calendar';

// 관리자 페이지
import AdminDashboard from './pages/admin/Dashboard';
import AdminEvents from './pages/admin/Events';
import AdminEventForm from './pages/admin/EventForm';
import AdminEventDetail from './pages/admin/EventDetail';
import AdminWorkers from './pages/admin/Workers';
import AdminAttendance from './pages/admin/Attendance';
import AdminSettings from './pages/admin/Settings';
import AdminCredits from './pages/admin/Credits';
import AdminAnalytics from './pages/admin/Analytics';
import AdminBigData from './pages/admin/BigData';
import AdminCompletedEvents from './pages/admin/CompletedEvents';
import AdminNftIssue from './pages/admin/NftIssue';

// 인증 필요 라우트
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// 관리자 전용 라우트
function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  const isAdmin = user?.is_admin || user?.role === 'admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* 공개 라우트 */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* 레이아웃 적용 라우트 */}
      <Route element={<Layout />}>
        {/* 홈 - 로그인 없이도 볼 수 있음 */}
        <Route path="/" element={<Home />} />

        {/* 행사 상세 - 로그인 없이도 볼 수 있음 */}
        <Route path="/events/:id" element={<EventDetail />} />

        {/* 인증 필요 */}

        {/* 오래된 라우트 → 새 통합 페이지로 리다이렉트 */}
        <Route path="/applications" element={<Navigate to="/work" replace />} />
        <Route path="/attendance" element={<Navigate to="/work" replace />} />
        <Route path="/work-history" element={<Navigate to="/work" replace />} />
        <Route path="/profile" element={<Navigate to="/my" replace />} />
        <Route
          path="/badges"
          element={
            <PrivateRoute>
              <Badges />
            </PrivateRoute>
          }
        />
        <Route
          path="/badges/:id"
          element={
            <PrivateRoute>
              <BadgeDetail />
            </PrivateRoute>
          }
        />

        {/* 새 통합 페이지 */}
        <Route
          path="/wallet"
          element={
            <PrivateRoute>
              <Wallet />
            </PrivateRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <PrivateRoute>
              <Notifications />
            </PrivateRoute>
          }
        />
        <Route
          path="/work"
          element={
            <PrivateRoute>
              <Work />
            </PrivateRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <PrivateRoute>
              <CalendarPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/collection"
          element={
            <PrivateRoute>
              <Collection />
            </PrivateRoute>
          }
        />
        <Route
          path="/my"
          element={
            <PrivateRoute>
              <My />
            </PrivateRoute>
          }
        />

        {/* 관리자 전용 */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/events"
          element={
            <AdminRoute>
              <AdminEvents />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/events/new"
          element={
            <AdminRoute>
              <AdminEventForm />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/events/:id"
          element={
            <AdminRoute>
              <AdminEventDetail />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/events/:id/edit"
          element={
            <AdminRoute>
              <AdminEventForm />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/workers"
          element={
            <AdminRoute>
              <AdminWorkers />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/attendance"
          element={
            <AdminRoute>
              <AdminAttendance />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <AdminRoute>
              <AdminSettings />
            </AdminRoute>
          }
        />
        {/* 토큰 관리 - /admin/wpt 사용 */}
        <Route path="/admin/credits" element={<Navigate to="/admin/wpt" replace />} />
        <Route
          path="/admin/wpt"
          element={
            <AdminRoute>
              <AdminCredits />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <AdminRoute>
              <AdminAnalytics />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/bigdata"
          element={
            <AdminRoute>
              <AdminBigData />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/events/completed"
          element={
            <AdminRoute>
              <AdminCompletedEvents />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/events/:id/nft-issue"
          element={
            <AdminRoute>
              <AdminNftIssue />
            </AdminRoute>
          }
        />
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
