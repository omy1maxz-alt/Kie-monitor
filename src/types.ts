export type HealthStatus = 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE' | 'CHECKING' | 'UNTESTED';

export interface KieMonitorResponse {
  code?: number;
  msg?: string;
  message?: string;
  rate?: number;
  successRate?: number;
  data?: {
    rate?: number;
    successRate?: number;
    status?: string;
    latency?: number;
  };
}

export interface ModelHealth {
  modelId: string;
  modelName: string;
  provider: string;
  successRate: number;
  status: HealthStatus;
  latencyMs: number;
  lastUpdated: string;
  errorMessage?: string | null;
  historyPoints: number[];
  isCustom: boolean;
}

export interface SystemStatusSummary {
  totalModels: number;
  operationalCount: number;
  degradedCount: number;
  outageCount: number;
  averageSuccessRate: number;
  averageLatencyMs: number;
  lastRefreshTime: string;
  activeCookieCount: number;
}

export type ModelFilter = 'ALL' | 'GOOGLE' | 'OPENAI' | 'ANTHROPIC' | 'DEEPSEEK' | 'ISSUES_ONLY';

export type SortOption = 'DEFAULT' | 'SUCCESS_RATE_ASC' | 'SUCCESS_RATE_DESC' | 'LATENCY_ASC' | 'NAME_ASC';
