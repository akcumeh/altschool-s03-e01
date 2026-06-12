"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiLogin, apiRegister } from "@/lib/api";

interface JwtPayload {
  sub: string;
  email: string;
  role: "creator" | "eventee";
  name?: string;
  iat: number;
  exp: number;
}

export interface AuthUser {
  id: string;
  email: string;
  role: "creator" | "eventee";
  name?: string;
}

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (name: string, email: string, password: string, role: "creator" | "eventee") => Promise<AuthUser>;
  logout: () => void;
  isLoading: boolean;
}

function parseJwt(token: string): JwtPayload {
  const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(base64)) as JwtPayload;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  token: null,
  login: async () => { throw new Error("Not mounted"); },
  register: async () => { throw new Error("Not mounted"); },
  logout: () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("ev_token");
    if (stored) {
      try {
        const payload = parseJwt(stored);
        if (payload.exp * 1000 > Date.now()) {
          setToken(stored);
          setUser({ id: payload.sub, email: payload.email, role: payload.role, name: payload.name });
        } else {
          localStorage.removeItem("ev_token");
        }
      } catch {
        localStorage.removeItem("ev_token");
      }
    }
    setIsLoading(false);
  }, []);

  function _applyToken(newToken: string): AuthUser {
    const payload = parseJwt(newToken);
    const userData: AuthUser = { id: payload.sub, email: payload.email, role: payload.role, name: payload.name };
    localStorage.setItem("ev_token", newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  }

  async function login(email: string, password: string): Promise<AuthUser> {
    const data = await apiLogin({ email, password });
    return _applyToken(data.access_token);
  }

  async function register(
    name: string, email: string, password: string,
    role: "creator" | "eventee",
  ): Promise<AuthUser> {
    await apiRegister({ name, email, password, role });
    const data = await apiLogin({ email, password });
    return _applyToken(data.access_token);
  }

  function logout() {
    localStorage.removeItem("ev_token");
    localStorage.removeItem("ev_pending_event");
    setToken(null);
    setUser(null);
  }

  return <Ctx.Provider value={{ user, token, login, register, logout, isLoading }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
