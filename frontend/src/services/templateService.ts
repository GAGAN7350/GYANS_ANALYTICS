import api from './api';

export type TemplateTier = 'beginner' | 'pro' | 'ultra_pro';

export interface ReportTemplate {
  id: string;
  userId?: string | null;
  workspaceId?: string | null;
  name: string;
  description?: string | null;
  tier: TemplateTier;
  domain?: string | null;
  isPreset: boolean;
  config: Record<string, any>;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CreateTemplatePayload {
  name: string;
  description?: string;
  tier: TemplateTier;
  domain?: string;
  config: Record<string, any>;
  workspaceId?: string;
}

export interface UpdateTemplatePayload {
  name?: string;
  description?: string;
  tier?: TemplateTier;
  domain?: string;
  config?: Record<string, any>;
}

export const templateService = {
  list: async (tier?: TemplateTier): Promise<ReportTemplate[]> => {
    const params = tier ? { tier } : {};
    const response = await api.get<ReportTemplate[]>('/templates/', { params });
    return response.data;
  },

  create: async (payload: CreateTemplatePayload): Promise<ReportTemplate> => {
    const response = await api.post<ReportTemplate>('/templates/', payload);
    return response.data;
  },

  get: async (id: string): Promise<ReportTemplate> => {
    const response = await api.get<ReportTemplate>(`/templates/${id}`);
    return response.data;
  },

  update: async (id: string, payload: UpdateTemplatePayload): Promise<ReportTemplate> => {
    const response = await api.put<ReportTemplate>(`/templates/${id}`, payload);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/templates/${id}`);
  },
};
