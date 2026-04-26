import { create } from 'zustand';
import { API_ENDPOINTS, getAuthHeaders } from '../config/api';

interface User {
  id: string;
  email: string;
  nickname: string | null;
  subscription_type: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, nickname?: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('pchat_token'),
  isAuthenticated: !!localStorage.getItem('pchat_token'),
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(API_ENDPOINTS.auth.login, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }

      const data = await response.json();
      localStorage.setItem('pchat_token', data.token);
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  register: async (email: string, password: string, nickname?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(API_ENDPOINTS.auth.register, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, nickname }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed');
      }

      // Registration successful, no need to store data
      await response.json();
      set({ isLoading: false });
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('pchat_token');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('pchat_token');
    if (!token) {
      set({ isAuthenticated: false, user: null });
      return;
    }

    try {
      const response = await fetch(API_ENDPOINTS.auth.me, {
        headers: getAuthHeaders() as Record<string, string>,
      });

      if (response.ok) {
        const user = await response.json();
        set({ user, isAuthenticated: true });
      } else {
        localStorage.removeItem('pchat_token');
        set({ user: null, token: null, isAuthenticated: false });
      }
    } catch {
      localStorage.removeItem('pchat_token');
      set({ user: null, token: null, isAuthenticated: false });
    }
  },
}));
