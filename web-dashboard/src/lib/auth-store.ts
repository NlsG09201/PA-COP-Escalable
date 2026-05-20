import { create } from "zustand";
import { persist } from "zustand/middleware";
import { dashboardApi } from "./api";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  roles: string[];
  login: (username: string, password: string, siteId?: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      roles: [],
      login: async (username, password, siteId) => {
        const res = await dashboardApi.login({ username, password, siteId });
        const payload = JSON.parse(atob(res.accessToken.split(".")[1] ?? "e30=")) as {
          roles?: string[];
        };
        set({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          roles: payload.roles ?? [],
        });
      },
      logout: () => set({ accessToken: null, refreshToken: null, roles: [] }),
      hasRole: (...roles) => {
        const mine = get().roles;
        if (mine.includes("SUPER_ADMIN")) return true;
        return roles.some((r) => mine.includes(r));
      },
    }),
    { name: "cop-dashboard-auth" },
  ),
);
