import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 토큰 인터셉터
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 에러 인터셉터
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (phone, code) => api.post('/api/auth/phone', { phone, code }),
  me: () => api.get('/api/auth/me'),
  // Email auth
  emailLogin: (email, password) => api.post('/api/auth/login', { email, password }),
  emailRegister: (data) => api.post('/api/auth/register', data),
  changePassword: (currentPassword, newPassword) => api.post('/api/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
};

// Email Verification API
export const emailAPI = {
  sendCode: (email) => api.post('/api/email/send-code', { email }),
  verifyCode: (email, code) => api.post('/api/email/verify-code', { email, code }),
  checkVerification: (email) => api.get(`/api/email/check/${email}`),
};

// Workers API
export const workersAPI = {
  create: (data) => api.post('/api/workers', data),
  getMe: () => api.get('/api/workers/me'),
  updateMe: (data) => api.patch('/api/workers/me', data),
  deleteMe: () => api.delete('/api/workers/me'),
  uploadPhoto: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/workers/me/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  // 사진 경로에서 파일명 추출하여 nginx에서 제공하는 URL 반환
  getPhotoUrlFromPath: (photoPath) => {
    if (!photoPath) return null;
    const filename = photoPath.split('/').pop();
    return `/photos/${filename}`;
  },
  getMyPhotoUrl: () => `${API_BASE_URL}/api/workers/me/photo`,
  list: () => api.get('/api/workers'),
  get: (id) => api.get(`/api/workers/${id}`),
  getPhotoUrl: (id) => `${API_BASE_URL}/api/workers/${id}/photo`,
  // Admin only
  update: (id, data) => api.patch(`/api/workers/${id}`, data),
  delete: (id) => api.delete(`/api/workers/${id}`),
};

// Events API
export const eventsAPI = {
  getList: (status) => api.get('/api/events', { params: { status } }),
  list: (status) => api.get('/api/events', { params: { status } }),
  getDetail: (id) => api.get(`/api/events/${id}`),
  get: (id) => api.get(`/api/events/${id}`),
  create: (data) => api.post('/api/events', data),
  update: (id, data) => api.patch(`/api/events/${id}`, data),
  delete: (id) => api.delete(`/api/events/${id}`),
};

// Applications API
export const applicationsAPI = {
  create: (eventId) => api.post('/api/applications', { event_id: eventId }),
  getMyList: () => api.get('/api/applications/me'),
  getMyApplications: () => api.get('/api/applications/me'),
  get: (id) => api.get(`/api/applications/${id}`),
  updateStatus: (id, status, reason) => api.patch(`/api/applications/${id}/status`, { status, rejection_reason: reason }),
  cancel: (id) => api.delete(`/api/applications/${id}`),
  checkConflict: (eventId) => api.post('/api/applications/check-conflict', null, { params: { event_id: eventId } }),
};

// Attendance API
export const attendanceAPI = {
  checkIn: (code) => api.post('/api/attendance/check-in', { check_in_code: code }),
  checkOut: (id) => api.post(`/api/attendance/${id}/check-out`),
  getMyList: () => api.get('/api/attendance/me'),
  downloadPaymentStatement: (id) => api.get(`/api/attendance/${id}/payment-statement`, { responseType: 'blob' }),

  // GPS Based Attendance
  updateLocation: (eventId, latitude, longitude) =>
    api.post('/api/attendance/location', null, { params: { event_id: eventId, latitude, longitude } }),

  // 관리자 주도 출퇴근 API
  getConfirmedWorkers: (eventId) => api.get(`/api/attendance/admin/confirmed-workers/${eventId}`),
  adminCheckIn: (applicationId, manual = false, latitude = null, longitude = null) =>
    api.post(`/api/attendance/admin/check-in/${applicationId}`, null, {
      params: { manual, latitude, longitude }
    }),
  adminCheckOut: (attendanceId, manual = false, latitude = null, longitude = null) =>
    api.post(`/api/attendance/admin/check-out/${attendanceId}`, null, {
      params: { manual, latitude, longitude }
    }),
};

// Admin API
export const adminAPI = {
  dashboard: () => api.get('/api/admin/dashboard'),
  getWorkers: () => api.get('/api/workers'),
  getAllWorkers: () => api.get('/api/auth/workers'),
  setAdmin: (workerId, isAdmin) => api.post(`/api/auth/set-admin/${workerId}?is_admin=${isAdmin}`),
  getEventApplications: (eventId) => api.get(`/api/admin/events/${eventId}/applications`),
  updateApplicationStatus: (appId, data) => api.patch(`/api/applications/${appId}/status`, data),
  getEventAttendance: (eventId) => api.get(`/api/admin/events/${eventId}/attendance`),
  forceCheckOut: (id) => api.post(`/api/attendance/${id}/check-out`),
  // Settings
  getSettings: () => api.get('/api/admin/settings'),
  addAdminPhone: (phone) => api.post('/api/admin/settings/admin-phones', { phone }),
  removeAdminPhone: (phone) => api.delete(`/api/admin/settings/admin-phones/${phone}`),
  // Excel Export
  exportPayroll: (eventId) => api.get(`/api/admin/events/${eventId}/export`, { responseType: 'blob' }),
  exportReport: (eventId) => api.get(`/api/admin/events/${eventId}/report`, { responseType: 'blob' }),
  // Analytics
  getAnalytics: (period = '30') => api.get('/api/admin/analytics', { params: { period } }),
  getWorkerAnalytics: () => api.get('/api/admin/analytics/workers'),
  getRevenueAnalytics: (period = '30') => api.get('/api/admin/analytics/revenue', { params: { period } }),
  getEventAnalytics: () => api.get('/api/admin/analytics/events'),
  // AI Matching
  getRecommendedWorkers: (eventId, limit = 20) => api.get(`/api/admin/events/${eventId}/recommend`, { params: { limit } }),
};

// Chain API
export const chainAPI = {
  getAllLogs: (limit = 100, offset = 0) => api.get('/api/chain/logs', { params: { limit, offset } }),
  getMyLogs: () => api.get('/api/chain/logs/me'),
  getTokens: () => api.get('/api/chain/tokens'),
  downloadCertificate: (logId) => api.post(`/api/chain/certificate/${logId}`, {}, { responseType: 'blob' }),
  adminDownloadCertificate: (logId) => api.post(`/api/chain/certificate/admin/${logId}`, {}, { responseType: 'blob' }),
  verify: (txHash) => api.post('/api/chain/verify', { tx_hash: txHash }),
  getStatus: () => api.get('/api/chain/status'),
};

// Notifications API
export const notificationsAPI = {
  getList: () => api.get('/api/notifications'),
  getUnreadCount: () => api.get('/api/notifications/unread-count'),
  markAsRead: (id) => api.post(`/api/notifications/${id}/read`),
  markAllAsRead: () => api.post('/api/notifications/read-all'),
};

// Credits API (WPT)
export const creditsAPI = {
  getMyBalance: () => api.get('/api/credits/me'),
  getMyHistory: (limit = 50) => api.get('/api/credits/me/history', { params: { limit } }),
  burn: (amount, reason) => api.post('/api/credits/burn', { amount, reason }),
  getTokenInfo: () => api.get('/api/credits/token-info'),
  // Daily check-in
  getCheckinStatus: () => api.get('/api/credits/checkin/status'),
  checkin: () => api.post('/api/credits/checkin'),
  getCheckinHistory: (limit = 30) => api.get('/api/credits/checkin/history', { params: { limit } }),
  // Admin only
  mint: (workerId, amount, reason) => api.post('/api/credits/mint', { worker_id: workerId, amount, reason }),
  getWorkerBalance: (workerId) => api.get(`/api/credits/${workerId}`),
  // Admin dashboard
  getAdminStats: () => api.get('/api/credits/admin/stats'),
  getAdminHistory: (limit = 100, offset = 0, txType = null) =>
    api.get('/api/credits/admin/history', { params: { limit, offset, tx_type: txType } }),
  getWorkersWithBadges: (limit = 100) => api.get('/api/credits/admin/workers-with-badges', { params: { limit } }),
};

// Badges API (성과 배지 / NFT)
export const badgesAPI = {
  getMyBadges: () => api.get('/api/badges/me'),
  getDefinitions: () => api.get('/api/badges/definitions'),
  // Admin only
  getWorkerBadges: (workerId) => api.get(`/api/badges/${workerId}`),
  checkWorkerBadges: (workerId) => api.post(`/api/badges/${workerId}/check`),
};

// NFT Image API
export const nftAPI = {
  // Worker endpoints
  getMyBadges: () => api.get('/api/nft/worker/me/badges'),
  getMyBadgeDetail: (awardId) => api.get(`/api/nft/worker/me/badges/${awardId}`),
  // 배지 이미지 URL 생성 (SVG)
  getBadgeImageUrl: (badgeId) => `${API_BASE_URL}/api/nft/render/${badgeId}`,
  // 배지 미리보기 URL (인증 불필요)
  getPreviewUrl: (badgeType, badgeLevel, template = 'minimal') =>
    `${API_BASE_URL}/api/nft/preview/${badgeType}/${badgeLevel}?template=${template}`,
  // 커스텀 렌더링 (POST)
  renderCustom: (data) => api.post('/api/nft/render', data, { responseType: 'blob' }),
  // 배지 메타데이터 조회
  getMetadata: (badgeId) => api.get(`/api/nft/metadata/${badgeId}`),
  // 등급 정보 조회
  getGrades: () => api.get('/api/nft/grades'),
  // Admin only
  getAdminBadgeImageUrl: (badgeId) => `${API_BASE_URL}/api/nft/render/admin/${badgeId}`,
  getCompletedEvents: () => api.get('/api/nft/admin/events/completed'),
  getEligibleWorkers: (eventId) => api.get(`/api/nft/admin/events/${eventId}/eligible-workers`),
  issueProjectBadges: (eventId, data) => api.post(`/api/nft/admin/events/${eventId}/nft-issue`, data),
};

// BigData API
export const bigdataAPI = {
  // 지역 마스터
  getRegions: (sido) => api.get('/api/bigdata/regions', { params: { sido } }),
  createRegion: (data) => api.post('/api/bigdata/regions', data),
  updateRegion: (id, data) => api.put(`/api/bigdata/regions/${id}`, data),
  deleteRegion: (id) => api.delete(`/api/bigdata/regions/${id}`),
  deleteAllRegions: () => api.delete('/api/bigdata/regions'),
  initRegions: () => api.post('/api/bigdata/init/regions'),

  // 업종 마스터
  getCategories: (parentId) => api.get('/api/bigdata/categories', { params: { parent_id: parentId } }),
  createCategory: (data) => api.post('/api/bigdata/categories', data),
  updateCategory: (id, data) => api.put(`/api/bigdata/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/api/bigdata/categories/${id}`),
  deleteAllCategories: () => api.delete('/api/bigdata/categories'),
  initCategories: () => api.post('/api/bigdata/init/categories'),

  // 기술/자격증
  getSkills: (category) => api.get('/api/bigdata/skills', { params: { category } }),
  createSkill: (data) => api.post('/api/bigdata/skills', data),
  updateSkill: (id, data) => api.put(`/api/bigdata/skills/${id}`, data),
  deleteSkill: (id) => api.delete(`/api/bigdata/skills/${id}`),
  deleteAllSkills: () => api.delete('/api/bigdata/skills'),
  initSkills: () => api.post('/api/bigdata/init/skills'),

  // 근무자 기술
  getWorkerSkills: (workerId) => api.get(`/api/bigdata/workers/${workerId}/skills`),
  addWorkerSkill: (workerId, data) => api.post(`/api/bigdata/workers/${workerId}/skills`, data),

  // 평가/피드백
  createRating: (attendanceId, data) => api.post(`/api/bigdata/attendance/${attendanceId}/rating`, data),
  getAttendanceRatings: (attendanceId) => api.get(`/api/bigdata/attendance/${attendanceId}/ratings`),
  getWorkerRatingStats: (workerId) => api.get(`/api/bigdata/workers/${workerId}/rating-stats`),

  // 이력 조회
  getWorkerHistory: (workerId, limit = 50) => api.get(`/api/bigdata/workers/${workerId}/history`, { params: { limit } }),
  getApplicationHistory: (applicationId) => api.get(`/api/bigdata/applications/${applicationId}/history`),

  // 월별 통계
  getWorkerMonthlyStats: (workerId, year, month) => api.get(`/api/bigdata/workers/${workerId}/monthly-stats`, { params: { year, month } }),
  calculateWorkerStats: (workerId, data) => api.post(`/api/bigdata/workers/${workerId}/calculate-stats`, data),

  // 분석 요약
  getAnalyticsSummary: (year, month) => api.get('/api/bigdata/analytics/summary', { params: { year, month } }),
  getWorkerAnalytics: (workerId) => api.get(`/api/bigdata/analytics/worker/${workerId}`),

  // 배치 작업
  batchCalculateStats: (data) => api.post('/api/bigdata/batch/calculate-all-stats', data),
  batchUpdateCumulative: () => api.post('/api/bigdata/batch/update-cumulative'),
};

// Gamification API
export const gamificationAPI = {
  // 내 통계
  getMyStats: () => api.get('/api/gamification/me/stats'),
  getMyStreaks: () => api.get('/api/gamification/me/streaks'),

  // 리더보드
  getLeaderboard: (period = 'all', limit = 50) =>
    api.get('/api/gamification/leaderboard', { params: { period, limit } }),

  // 보상 (attendance API에서 자동 호출되므로 frontend에서 직접 호출 불필요)
  // checkinReward: (attendanceId) => api.post('/api/gamification/checkin-reward', { attendance_id: attendanceId }),
  // checkoutReward: (attendanceId) => api.post('/api/gamification/checkout-reward', { attendance_id: attendanceId }),

  // 레벨 시스템
  getLevels: () => api.get('/api/gamification/levels'),
  getMyLevel: () => api.get('/api/gamification/me/level'),

  // WPT 거래 내역
  getMyTransactions: (limit = 50, txType = null) =>
    api.get('/api/gamification/me/wpt-transactions', { params: { limit, tx_type: txType } }),
};

// AI Matching API
export const aiMatchingAPI = {
  // 근로자용: 추천 행사 (auth required)
  getRecommendedEvents: (limit = 10, minScore = 50) =>
    api.get('/api/ai/recommend-events', { params: { limit, min_score: minScore } }),

  // 관리자용: 추천 근로자 (auth required)
  getRecommendedWorkers: (eventId, limit = 20, minScore = 60) =>
    api.get(`/api/ai/recommend-workers/${eventId}`, { params: { limit, min_score: minScore } }),

  // 매칭 통계 (admin only)
  getMatchingStats: (days = 30) =>
    api.get('/api/ai/matching-stats', { params: { days } }),
};

export default api;
