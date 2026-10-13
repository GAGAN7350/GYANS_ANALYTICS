// Common responses
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// User & Auth
export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password?: string;
}

export interface SignupRequest {
  email: string;
  password?: string;
  fullName: string;
}

// Workspace
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: string;
}

export interface WorkspaceCreate {
  name: string;
  description?: string;
}

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: 'admin' | 'member' | 'viewer';
}

// Dataset
export interface Dataset {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  sourceType: 'file' | 'database';
  status: 'ready' | 'refreshing' | 'error';
  rowCount?: number;
  columns: DatasetColumn[];
  createdAt: string;
  updatedAt: string;
}

export interface DatasetColumn {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  description?: string;
}

export interface DatasetCreate {
  name: string;
  description?: string;
  sourceType: 'file' | 'database';
  connectionDetails?: any;
}

// Dashboard
export interface Dashboard {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  widgets: Widget[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardCreate {
  name: string;
  description?: string;
}

export interface DashboardUpdate {
  name?: string;
  description?: string;
}

// Widget
export enum ChartType {
  BAR = 'bar',
  LINE = 'line',
  PIE = 'pie',
  TABLE = 'table',
  NUMBER = 'number'
}

export interface Widget {
  id: string;
  dashboardId: string;
  datasetId: string;
  name: string;
  type: ChartType;
  config: any; // ECharts config or specific chart config
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface WidgetCreate {
  datasetId: string;
  name: string;
  type: ChartType;
  config: any;
  layout: { x: number; y: number; w: number; h: number };
}

export interface WidgetUpdate {
  name?: string;
  type?: ChartType;
  config?: any;
  layout?: { x: number; y: number; w: number; h: number };
}

// Query
export interface Query {
  id: string;
  workspaceId: string;
  datasetId: string;
  name: string;
  sql: string;
  createdAt: string;
}

export interface QueryExecuteRequest {
  sql: string;
  datasetId?: string;
}

export interface QueryResult {
  columns: string[];
  rows: any[][];
  executionTimeMs: number;
}
