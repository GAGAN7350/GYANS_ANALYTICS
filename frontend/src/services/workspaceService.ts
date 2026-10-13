import api from './api';
import { Workspace, WorkspaceCreate } from '@/types';

export const workspaceService = {
  list: async (): Promise<Workspace[]> => {
    const response = await api.get<{ data: Workspace[] }>('/workspaces');
    return response.data.data;
  },

  create: async (data: WorkspaceCreate): Promise<Workspace> => {
    const response = await api.post<{ data: Workspace }>('/workspaces', data);
    return response.data.data;
  },

  get: async (id: string): Promise<Workspace> => {
    const response = await api.get<{ data: Workspace }>(`/workspaces/${id}`);
    return response.data.data;
  },

  update: async (id: string, data: Partial<WorkspaceCreate>): Promise<Workspace> => {
    const response = await api.put<{ data: Workspace }>(`/workspaces/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/workspaces/${id}`);
  },
};
