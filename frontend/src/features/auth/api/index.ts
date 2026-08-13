import apiClient from "@/shared/api/apiClient";
import { UserProfile } from "@/store/authStore";
import { LoginDTO, RegisterDTO } from "../models";

export async function apiLogin(
  data: LoginDTO,
  signal?: AbortSignal
): Promise<UserProfile> {
  const res = await apiClient.post<UserProfile>("/auth/login", data, { signal });
  return res.data;
}

export async function apiRegister(
  data: RegisterDTO,
  signal?: AbortSignal
): Promise<UserProfile> {
  const res = await apiClient.post<UserProfile>("/auth/register", data, {
    signal,
  });
  return res.data;
}

export async function apiLogout(signal?: AbortSignal): Promise<void> {
  await apiClient.post("/auth/logout", {}, { signal });
}

export async function apiGetMe(signal?: AbortSignal): Promise<UserProfile> {
  const res = await apiClient.get<UserProfile>("/auth/me", { signal });
  return res.data;
}
