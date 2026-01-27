import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor for auth token
api.interceptors.request.use(
  (config) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refresh_token");
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/api/auth/refresh`, {
            refresh_token: refreshToken,
          });

          const { access_token, refresh_token } = response.data;
          localStorage.setItem("access_token", access_token);
          localStorage.setItem("refresh_token", refresh_token);

          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/auth/login";
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/api/auth/login", { email, password }),
  signup: (data: SignupData) => api.post("/api/auth/signup", data),
  refresh: (refreshToken: string) =>
    api.post("/api/auth/refresh", { refresh_token: refreshToken }),
  me: () => api.get("/api/auth/me"),
  logout: () => api.post("/api/auth/logout"),
};

// Worker API
export const workerApi = {
  getProfile: () => api.get("/api/worker/profile"),
  updateProfile: (data: any) => api.patch("/api/worker/profile", data),
  updatePrivate: (data: any) => api.patch("/api/worker/profile/private", data),
  updatePreferences: (data: any) => api.patch("/api/worker/preferences", data),
  getSchedule: (params?: any) => api.get("/api/worker/schedule", { params }),
  getApplications: (status?: string) =>
    api.get("/api/worker/applications", { params: { status } }),
  apply: (positionId: string, note?: string) =>
    api.post("/api/worker/apply", { position_id: positionId, note }),
  cancelApplication: (id: string) => api.delete(`/api/worker/applications/${id}`),
  searchEvents: (params: any) => api.get("/api/worker/events", { params }),
  getPayroll: (yearMonth?: string) =>
    api.get("/api/worker/payroll", { params: { year_month: yearMonth } }),
  getFollowing: () => api.get("/api/worker/following"),
  followOrg: (orgId: string) => api.post("/api/worker/follow", { org_id: orgId }),
  unfollowOrg: (orgId: string) => api.delete(`/api/worker/follow/${orgId}`),
};

// Organization API
export const orgApi = {
  register: (data: any) => api.post("/api/org/register", data),
  getMyOrgs: () => api.get("/api/org/my"),
  getOrg: (id: string) => api.get(`/api/org/${id}`),
  updateOrg: (id: string, data: any) => api.patch(`/api/org/${id}`, data),
  getMembers: (orgId: string) => api.get(`/api/org/${orgId}/members`),
  createInvite: (orgId: string) => api.post(`/api/org/${orgId}/invite`),
  getFollowers: (orgId: string, page?: number) =>
    api.get(`/api/org/${orgId}/followers`, { params: { page } }),
  followWorker: (orgId: string, workerId: string, note?: string) =>
    api.post(`/api/org/${orgId}/follow`, { worker_id: workerId, note }),
  unfollowWorker: (orgId: string, workerId: string) =>
    api.delete(`/api/org/${orgId}/follow/${workerId}`),
  blockWorker: (orgId: string, workerId: string, reason?: string) =>
    api.post(`/api/org/${orgId}/block`, { worker_id: workerId, reason }),
  getEvents: (orgId: string, params?: any) =>
    api.get(`/api/org/${orgId}/events`, { params }),
  createEvent: (orgId: string, data: any) =>
    api.post(`/api/org/${orgId}/events`, data),
  getEventApplications: (orgId: string, eventId: string, status?: string) =>
    api.get(`/api/org/${orgId}/events/${eventId}/applications`, {
      params: { status },
    }),
  reviewApplication: (orgId: string, applicationId: string, data: any) =>
    api.patch(`/api/org/${orgId}/applications/${applicationId}`, data),
};

// Admin API
export const adminApi = {
  getStats: () => api.get("/api/admin/stats"),
  getDailyStats: (days?: number) =>
    api.get("/api/admin/stats/daily", { params: { days } }),
  getOrganizations: (params?: any) =>
    api.get("/api/admin/organizations", { params }),
  getOrganizationDetail: (id: string) =>
    api.get(`/api/admin/organizations/${id}`),
  verifyOrganization: (id: string, data: { is_verified: boolean }) =>
    api.patch(`/api/admin/organizations/${id}/verify`, data),
  deleteOrganization: (id: string) =>
    api.delete(`/api/admin/organizations/${id}`),
  getUsers: (params?: any) => api.get("/api/admin/users", { params }),
  updateUserRole: (id: string, data: { platform_role: string }) =>
    api.patch(`/api/admin/users/${id}/role`, data),
  updateUserStatus: (id: string, data: { is_active: boolean }) =>
    api.patch(`/api/admin/users/${id}/status`, data),
  getWorkers: (params?: any) => api.get("/api/admin/workers", { params }),
  updateTrustScore: (id: string, data: { trust_score: number; reason: string }) =>
    api.patch(`/api/admin/workers/${id}/trust-score`, data),
};

// Types
interface SignupData {
  email: string;
  password: string;
  name: string;
  phone?: string;
  nickname?: string;
  region?: string;
  work_types?: string[];
  invite_code?: string;
}
