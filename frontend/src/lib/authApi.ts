import { request, setAccessToken } from "./client";

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export async function login(email: string, password: string) {
  const data = await request<AuthResponse>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  setAccessToken(data.access_token);
  return data;
}

export async function register(email: string, password: string) {
  const data = await request<AuthResponse>("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  setAccessToken(data.access_token);
  return data;
}

export async function refresh() {
  const data = await request<{ access_token: string; token_type: string }>("/auth/refresh", {
    method: "POST",
  });
  setAccessToken(data.access_token);
  return data;
}

export async function logout() {
  await request<void>("/auth/logout", { method: "POST" });
  setAccessToken(null);
}

export async function me() {
  return request<User>("/users/me");
}
