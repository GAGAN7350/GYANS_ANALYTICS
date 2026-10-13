import api from './api';
import { Dashboard, DashboardCreate, DashboardUpdate, Widget, WidgetCreate, WidgetUpdate } from '@/types';

export const dashboardService = {
  list: async (workspaceId: string): Promise<Dashboard[]> => {
    const response = await api.get<{ data: Dashboard[] }>(`/workspaces/${workspaceId}/dashboards`);
    return response.data.data;
  },

  create: async (data: DashboardCreate & { workspaceId: string }): Promise<Dashboard> => {
    const { workspaceId, ...payload } = data;
    const response = await api.post<{ data: Dashboard }>(`/workspaces/${workspaceId}/dashboards`, payload);
    return response.data.data;
  },

  get: async (id: string): Promise<Dashboard> => {
    const response = await api.get<{ data: Dashboard }>(`/dashboards/${id}`);
    return response.data.data;
  },

  update: async (id: string, data: DashboardUpdate): Promise<Dashboard> => {
    const response = await api.put<{ data: Dashboard }>(`/dashboards/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/dashboards/${id}`);
  },

  duplicate: async (id: string): Promise<Dashboard> => {
    const response = await api.post<{ data: Dashboard }>(`/dashboards/${id}/duplicate`);
    return response.data.data;
  },

  addWidget: async (dashboardId: string, data: WidgetCreate): Promise<Widget> => {
    const response = await api.post<{ data: Widget }>(`/dashboards/${dashboardId}/widgets`, data);
    return response.data.data;
  },

  updateWidget: async (dashboardId: string, widgetId: string, data: WidgetUpdate): Promise<Widget> => {
    const response = await api.put<{ data: Widget }>(`/dashboards/${dashboardId}/widgets/${widgetId}`, data);
    return response.data.data;
  },

  deleteWidget: async (dashboardId: string, widgetId: string): Promise<void> => {
    await api.delete(`/dashboards/${dashboardId}/widgets/${widgetId}`);
  },
};
