import { create } from 'zustand';
import { User, LoginRequest, SignupRequest } from '@/types';
import { authService } from '@/services/authService';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  login: (data: LoginRequest) => Promise<void>;
  signup: (data: SignupRequest) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: true,

  login: async (data: LoginRequest) => {
    const res = await authService.login(data);
    localStorage.setItem('token', res.accessToken);
    set({ user: res.user, token: res.accessToken, isAuthenticated: true });
  },

  signup: async (data: SignupRequest) => {
    const res = await authService.signup(data);
    localStorage.setItem('token', res.accessToken);
    set({ user: res.user, token: res.accessToken, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadUser: async () => {
    const token = get().token;
    if (!token) {
      set({ isLoading: false });
      return;
    }
    
    try {
      set({ isLoading: true });
      const user = await authService.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      // Only logout on explicit 401 (invalid/expired token).
      // On network errors (backend down), keep the user logged in
      // so they don't get kicked to login just because server is restarting.
      const status = error?.response?.status;
      if (status === 401) {
        localStorage.removeItem('token');
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      } else {
        // Network error or 5xx — trust the stored token, stay authenticated
        console.warn('Could not reach server during loadUser, keeping existing auth state');
        set({ isLoading: false });
      }
    }
  },
}));
