import api from './api';
import { User, TokenResponse, LoginRequest, SignupRequest } from '@/types';

export const authService = {
  login: async (data: LoginRequest): Promise<TokenResponse> => {
    const response = await api.post<TokenResponse>('/auth/login', data);
    return response.data;
  },

  signup: async (data: SignupRequest): Promise<TokenResponse> => {
    const response = await api.post<TokenResponse>('/auth/signup', data);
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },

  updateProfile: async (data: Partial<User>): Promise<User> => {
    const response = await api.put<User>('/auth/me', data);
    return response.data;
  },

  refreshToken: async (): Promise<TokenResponse> => {
    const response = await api.post<TokenResponse>('/auth/refresh');
    return response.data;
  },
};
