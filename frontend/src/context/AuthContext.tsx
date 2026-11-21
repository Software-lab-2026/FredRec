import { useEffect, useState, type ReactNode } from "react";
import * as authApi from "../api/auth";
import { getToken } from "../api/client";
import type { User } from "../types/resource";
import { AuthContext, type AuthState } from "./useAuth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Only loading if a stored token to validate
  const [loading, setLoading] = useState(() => !!getToken());

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    authApi.fetchCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const value: AuthState = {
    user,
    loading,
    login: async (username, password) =>
      setUser(await authApi.login(username, password)),
    signup: async (input) => setUser(await authApi.signup(input)),
    logout: () => {
      authApi.logout();
      setUser(null);
    },
    changePassword: async (currentPassword, newPassword) =>
      setUser(await authApi.changePassword(currentPassword, newPassword)),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
