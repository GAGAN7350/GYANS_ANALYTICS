import api from './api';
import { Dataset } from '@/types';

export interface DatasetPreviewData {
  columns: { name: string; type: string }[];
  rows: Record<string, any>[];
  total_rows: number;
  preview_count: number;
}

export interface ChartDataResponse {
  datasetId: string;
  chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'histogram';
  xCol: string | null;
  yCol: string | null;
  numericCols: string[];
  categoricalCols: string[];
  datetimeCols: string[];
  allCols: string[];
  data: {
    // bar / line
    x?: any[];
    y?: any[];
    // pie
    labels?: string[];
    values?: number[];
    // scatter
    points?: { x: number; y: number }[];
    // histogram
    bins?: number[];
    counts?: number[];
  };
}

export interface DatasetPatternsData {
  dataset_id: string;
  dataset_name: string;
  data_health?: {
    health_score: number;
    rating: string;
    total_rows: number;
    total_columns: number;
    missing_cells: number;
    duplicate_rows: number;
    diagnostic_notes: string[];
  };
  patterns?: {
    anomalies?: {
      detected: boolean;
      anomaly_count: number;
      anomaly_percentage: number;
      evaluated_columns: string[];
      anomalous_samples: Array<{
        row_index: number;
        anomaly_score: number;
        row_data: Record<string, any>;
      }>;
    };
    clusters?: {
      clustered: boolean;
      k: number;
      features_used: string[];
      clusters: Array<{
        cluster_id: number;
        name: string;
        size: number;
        percentage: number;
        feature_averages: Record<string, number>;
      }>;
    };
    correlations?: {
      has_correlations: boolean;
      top_drivers: Array<{
        feature_a: string;
        feature_b: string;
        correlation: number;
        strength: string;
        relationship: string;
      }>;
    };
  };
}

export const datasetService = {
  list: async (workspaceId?: string): Promise<Dataset[]> => {
    const params = workspaceId ? { workspace_id: workspaceId } : {};
    const response = await api.get<Dataset[]>('/datasets/', { params });
    return response.data;
  },

  upload: async (file: File, datasetName?: string, workspaceId?: string): Promise<Dataset> => {
    const formData = new FormData();
    formData.append('file', file);
    if (datasetName) formData.append('dataset_name', datasetName);
    if (workspaceId) formData.append('workspace_id', workspaceId);

    const response = await api.post<Dataset>('/datasets/upload', formData);
    return response.data;
  },

  get: async (id: string): Promise<Dataset> => {
    const response = await api.get<Dataset>(`/datasets/${id}`);
    return response.data;
  },

  preview: async (id: string, limit: number = 100): Promise<DatasetPreviewData> => {
    const response = await api.get<DatasetPreviewData>(`/datasets/${id}/preview`, {
      params: { limit },
    });
    return response.data;
  },

  patterns: async (id: string): Promise<DatasetPatternsData> => {
    const response = await api.get<DatasetPatternsData>(`/datasets/${id}/patterns`);
    return response.data;
  },

  chartData: async (
    id: string,
    opts?: { xCol?: string; yCol?: string; chartType?: string; limit?: number }
  ): Promise<ChartDataResponse> => {
    const response = await api.get<ChartDataResponse>(`/datasets/${id}/chart-data`, {
      params: {
        x_col:      opts?.xCol,
        y_col:      opts?.yCol,
        chart_type: opts?.chartType,
        limit:      opts?.limit ?? 500,
      },
    });
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/datasets/${id}`);
  },
};
