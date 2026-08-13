import { create } from "zustand";

export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
}

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  setUser: (user: UserProfile | null) => void;
  setLoading: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setLoading: (v) => set({ isLoading: v }),
}));
