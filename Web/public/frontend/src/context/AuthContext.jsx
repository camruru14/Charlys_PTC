import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { customer } = await api.get("/auth/me");
      setCustomer(customer);
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email, password) => {
    const { customer } = await api.post("/auth/login", { email, password });
    setCustomer(customer);
    return customer;
  };

  const register = async (data) => {
    const { customer } = await api.post("/auth/register", data);
    setCustomer(customer);
    return customer;
  };

  const logout = async () => {
    await api.post("/auth/logout");
    setCustomer(null);
  };

  const updateProfile = async (data) => {
    const { customer } = await api.put("/auth/me", data);
    setCustomer(customer);
    return customer;
  };

  const changePassword = async (currentPassword, newPassword) => {
    return api.put("/auth/password", { currentPassword, newPassword });
  };

  return (
    <AuthContext.Provider
      value={{ customer, loading, login, register, logout, refresh, updateProfile, changePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

export default AuthContext;
