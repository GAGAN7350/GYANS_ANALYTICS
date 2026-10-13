import api from './api';
import { TemplateTier } from './templateService';

export interface GenerateReportPayload {
  dataset_id: string;
  tier: TemplateTier;
  template_name?: string;
  config?: Record<string, any>;
}

export interface GeneratedReportResponse {
  datasetId: string;
  datasetName: string;
  reportTitle: string;
  tier: TemplateTier;
  domain: string;
  trafficLight?: 'green' | 'yellow' | 'red';
  trafficStatus?: string;
  healthScore: number;
  targetKpi: string;
  anomalyCount: number;
  anomalyPercentage: number;
  generatedAt: string;
  markdown: string;
}

export const aiService = {
  generateReport: async (payload: GenerateReportPayload): Promise<GeneratedReportResponse> => {
    const response = await api.post<GeneratedReportResponse>('/ai/generate-report', payload);
    return response.data;
  },
};
