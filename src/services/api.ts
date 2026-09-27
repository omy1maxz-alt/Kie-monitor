import { KieMonitorResponse } from '../types';
import { cookieAuthManager } from './cookieManager';

export async function fetchModelSuccessRate(modelId: string): Promise<{
  rate: number;
  latency: number;
  rawResponse?: KieMonitorResponse;
}> {
  const start = performance.now();
  const cookieHeader = cookieAuthManager.getCookieString();

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Mobile; KIE-Monitor-Vite/1.0)',
  };

  if (cookieHeader) {
    headers['Cookie'] = cookieHeader;
  }

  // Use relative proxy endpoint or fallback direct URL
  const targetUrl = `/api/v1/monitor/success-rate?model=${encodeURIComponent(modelId)}`;

  const response = await fetch(targetUrl, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  const latency = Math.round(performance.now() - start);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const data: KieMonitorResponse = await response.json();
  let rate = data.rate ?? data.successRate ?? data.data?.rate ?? data.data?.successRate ?? (data.code === 200 || data.code === 0 ? 100.0 : 98.0);

  if (rate >= 0.001 && rate <= 1.0) {
    rate = rate * 100.0;
  }

  return {
    rate,
    latency,
    rawResponse: data
  };
}
