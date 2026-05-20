import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "./api-client";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: Record<string, unknown> | null;
  setTokens: (access: string, refresh: string) => void;
  logout: () => void;
  loadMe: () => Promise<void>;
  login: (username: string, password: string, siteId?: string) => Promise<void>;
  register: (payload: Record<string, unknown>) => Promise<void>;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
      loadMe: async () => {
        const token = get().accessToken;
        if (!token) return;
        const user = await authApi.me(token);
        set({ user });
      },
      login: async (username, password, siteId) => {
        const res = await authApi.login({ username, password, siteId });
        set({ accessToken: res.accessToken, refreshToken: res.refreshToken });
        await get().loadMe();
      },
      register: async (payload) => {
        const res = await authApi.register(payload);
        set({ accessToken: res.accessToken, refreshToken: res.refreshToken });
        await get().loadMe();
      },
    }),
    { name: "cop-public-auth" },
  ),
);
