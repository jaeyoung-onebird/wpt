import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationsAPI } from '../api/client';

export default function Notifications() {
  const { user, worker } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (worker) {
      loadNotifications();
    } else {
      setLoading(false);
    }
  }, [worker]);

  const loadNotifications = async () => {
    try {
      const { data } = await notificationsAPI.getList();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await notificationsAPI.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  const getNotificationIcon = (type) => {
    const icons = {
      'APPLICATION_APPROVED': '✅',
      'APPLICATION_REJECTED': '❌',
      'EVENT_REMINDER': '📅',
      'CHECKIN_REMINDER': '⏰',
      'PAYMENT_COMPLETE': '💰',
      'BADGE_EARNED': '🏅',
      'WPT_RECEIVED': '🪙',
      'SYSTEM': '📢',
    };
    return icons[type] || '🔔';
  };

  if (!user) {
    return (
      <div className="p-4 animate-fade-in">
        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: 'var(--color-bg)' }}>
            🔒
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text-title)' }}>로그인이 필요합니다</p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-sub)' }}>알림을 확인하려면 로그인해주세요</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            로그인하기
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* 헤더 */}
      <div className="pt-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-title)' }}>알림</h1>
          {unreadCount > 0 && (
            <p className="text-sm mt-1" style={{ color: 'var(--color-primary)' }}>
              {unreadCount}개의 새 알림
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}
          >
            모두 읽음
          </button>
        )}
      </div>

      {/* 알림 목록 */}
      {notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => !notification.is_read && handleMarkAsRead(notification.id)}
              className="card cursor-pointer transition-all active:scale-[0.99]"
              style={{
                backgroundColor: notification.is_read ? 'var(--color-card)' : 'var(--color-primary-light)',
              }}
            >
              <div className="flex gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: notification.is_read ? 'var(--color-bg)' : 'white' }}
                >
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-sm ${notification.is_read ? '' : 'font-semibold'}`}
                      style={{ color: 'var(--color-text-title)' }}
                    >
                      {notification.title}
                    </p>
                    {!notification.is_read && (
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                      />
                    )}
                  </div>
                  <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                    {notification.message}
                  </p>
                  <p className="text-xs mt-2" style={{ color: 'var(--color-text-disabled)' }}>
                    {formatDate(notification.created_at)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: 'var(--color-bg)' }}>
            🔕
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text-title)' }}>알림이 없어요</p>
          <p className="text-sm" style={{ color: 'var(--color-text-sub)' }}>
            새로운 소식이 있으면 알려드릴게요
          </p>
        </div>
      )}
    </div>
  );
}
