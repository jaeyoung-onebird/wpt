import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, LoginResponse } from "@/types";

interface AuthState {
  user: User | null;
  workerProfileId: string | null;
  orgMemberships: { org_id: string; role: string }[];
  isAuthenticated: boolean;
  isLoading: boolean;

  setAuth: (response: LoginResponse) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      workerProfileId: null,
      orgMemberships: [],
      isAuthenticated: false,
      isLoading: true,

      setAuth: (response: LoginResponse) => {
        localStorage.setItem("access_token", response.tokens.access_token);
        localStorage.setItem("refresh_token", response.tokens.refresh_token);

        set({
          user: response.user,
          workerProfileId: response.worker_profile_id,
          orgMemberships: response.org_memberships,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      setUser: (user: User) => {
        set({ user, isLoading: false });
      },

      logout: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");

        set({
          user: null,
          workerProfileId: null,
          orgMemberships: [],
          isAuthenticated: false,
          isLoading: false,
        });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        workerProfileId: state.workerProfileId,
        orgMemberships: state.orgMemberships,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
