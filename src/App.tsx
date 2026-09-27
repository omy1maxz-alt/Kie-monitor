import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RefreshCw,
  Key,
  Settings,
  Plus,
  Search,
  SlidersHorizontal,
  X,
  Activity,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Trash2,
  Globe,
  Clock,
  Sparkles
} from 'lucide-react';
import { ModelHealth, HealthStatus, ModelFilter, SortOption, SystemStatusSummary } from './types';
import { cookieAuthManager, CookieAuthManager } from './services/cookieManager';
import { fetchModelSuccessRate } from './services/api';

const DEFAULT_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gpt-5-6-sol',
  'gpt-5-6-luna',
  'gpt-5-5',
  'gpt-5-2',
  'claude-sonnet-5',
  'claude-opus-5',
  'deepseek-v4-1-flash',
  'deepseek-r1',
];

function formatModelName(modelId: string): string {
  return modelId
    .split(/[-_]/)
    .map(word => {
      const lower = word.toLowerCase();
      if (['gpt', 'api', 'ai', 'r1', 'sol', 'luna', 'v4', 'v5'].includes(lower)) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function determineProvider(modelId: string): string {
  const lower = modelId.toLowerCase();
  if (lower.includes('gemini') || lower.includes('google')) return 'Google';
  if (lower.includes('gpt') || lower.includes('openai') || lower.includes('o1') || lower.includes('o3')) return 'OpenAI';
  if (lower.includes('claude') || lower.includes('anthropic')) return 'Anthropic';
  if (lower.includes('deepseek')) return 'DeepSeek';
  if (lower.includes('mistral') || lower.includes('mixtral')) return 'Mistral';
  if (lower.includes('llama') || lower.includes('meta')) return 'Meta';
  return 'KIE Gateway';
}

export function App() {
  const [customModels, setCustomModels] = useState<string[]>(() => CookieAuthManager.getCustomModels());
  const [models, setModels] = useState<ModelHealth[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<ModelFilter>('ALL');
  const [selectedSort, setSelectedSort] = useState<SortOption>('DEFAULT');
  const [cookieCount, setCookieCount] = useState<number>(() => cookieAuthManager.getCookieCount());
  const [savedCookieText, setSavedCookieText] = useState<string>(() => cookieAuthManager.loadSavedRaw());
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(() => CookieAuthManager.getInterval());
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true);
  const [lastRefreshTimestamp, setLastRefreshTimestamp] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [showAddModelModal, setShowAddModelModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [selectedModelDetails, setSelectedModelDetails] = useState<ModelHealth | null>(null);

  // Cookie input state inside modal
  const [cookieInput, setCookieInput] = useState('');
  const [newModelInput, setNewModelInput] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 2800);
  };

  const allModelIds = useMemo(() => {
    return Array.from(new Set([...DEFAULT_MODELS, ...customModels]));
  }, [customModels]);

  // Initial list setup
  useEffect(() => {
    setModels(prev => {
      const prevMap = new Map(prev.map(m => [m.modelId, m]));
      return allModelIds.map(id => {
        if (prevMap.has(id)) {
          return prevMap.get(id)!;
        }
        return {
          modelId: id,
          modelName: formatModelName(id),
          provider: determineProvider(id),
          successRate: 0,
          status: 'UNTESTED',
          latencyMs: 0,
          lastUpdated: 'Pending...',
          historyPoints: [],
          isCustom: !DEFAULT_MODELS.includes(id),
        };
      });
    });
  }, [allModelIds]);

  // Single model refresh
  const refreshSingleModel = useCallback(async (modelId: string) => {
    const timeStr = new Date().toLocaleTimeString();
    try {
      const res = await fetchModelSuccessRate(modelId);
      const rate = res.rate;
      const latency = res.latency;
      const status: HealthStatus = rate >= 90 ? 'OPERATIONAL' : rate >= 50 ? 'DEGRADED' : 'OUTAGE';

      setModels(prev =>
        prev.map(m => {
          if (m.modelId === modelId) {
            const nextHistory = [...(m.historyPoints || []), rate].slice(-10);
            return {
              ...m,
              successRate: rate,
              latencyMs: latency,
              status,
              lastUpdated: timeStr,
              errorMessage: null,
              historyPoints: nextHistory,
            };
          }
          return m;
        })
      );
    } catch (err: any) {
      setModels(prev =>
        prev.map(m => {
          if (m.modelId === modelId) {
            const nextHistory = [...(m.historyPoints || []), 0].slice(-10);
            return {
              ...m,
              successRate: 0,
              latencyMs: 0,
              status: 'OUTAGE',
              lastUpdated: timeStr,
              errorMessage: err.message || 'Connection failed',
              historyPoints: nextHistory,
            };
          }
          return m;
        })
      );
    }
  }, []);

  // Full status refresh
  const refreshAllStatus = useCallback(async () => {
    setIsRefreshing(true);
    const timeStr = new Date().toLocaleTimeString();

    const promises = allModelIds.map(async id => {
      try {
        const res = await fetchModelSuccessRate(id);
        const rate = res.rate;
        const latency = res.latency;
        const status: HealthStatus = rate >= 90 ? 'OPERATIONAL' : rate >= 50 ? 'DEGRADED' : 'OUTAGE';

        return {
          modelId: id,
          successRate: rate,
          latencyMs: latency,
          status,
          errorMessage: null,
        };
      } catch (err: any) {
        return {
          modelId: id,
          successRate: 0,
          latencyMs: 0,
          status: 'OUTAGE' as HealthStatus,
          errorMessage: err.message || 'Failed to connect',
        };
      }
    });

    const results = await Promise.all(promises);
    setLastRefreshTimestamp(timeStr);

    setModels(prev => {
      const resMap = new Map(results.map(r => [r.modelId, r]));
      return prev.map(m => {
        const r = resMap.get(m.modelId);
        if (r) {
          const nextHistory = [...(m.historyPoints || []), r.successRate].slice(-10);
          return {
            ...m,
            successRate: r.successRate,
            latencyMs: r.latencyMs,
            status: r.status,
            errorMessage: r.errorMessage,
            lastUpdated: timeStr,
            historyPoints: nextHistory,
          };
        }
        return m;
      });
    });

    setIsRefreshing(false);
  }, [allModelIds]);

  // Initial trigger & Auto refresh interval loop
  useEffect(() => {
    refreshAllStatus();
  }, [refreshAllStatus]);

  useEffect(() => {
    if (!isAutoRefreshEnabled) return;
    const intervalMs = Math.max(10, autoRefreshInterval) * 1000;
    const timer = setInterval(() => {
      refreshAllStatus();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isAutoRefreshEnabled, autoRefreshInterval, refreshAllStatus]);

  // Handle Cookie Save
  const handleSaveCookie = (rawText: string) => {
    const count = cookieAuthManager.parseAndSetCookies(rawText);
    cookieAuthManager.saveToStorage(rawText);
    setSavedCookieText(rawText);
    setCookieCount(count);
    setShowCookieModal(false);
    showToast(`Saved ${count} active cookies. Refreshing...`);
    refreshAllStatus();
  };

  const handleClearCookie = () => {
    cookieAuthManager.clearCookies();
    setSavedCookieText('');
    setCookieCount(0);
    setShowCookieModal(false);
    showToast('Cookies cleared');
    refreshAllStatus();
  };

  // Add custom model
  const handleAddCustomModel = (modelId: string) => {
    const clean = modelId.trim().toLowerCase();
    if (!clean) return;
    if (allModelIds.includes(clean)) {
      showToast('Model already in monitor list');
      return;
    }
    const next = [...customModels, clean];
    setCustomModels(next);
    CookieAuthManager.saveCustomModels(next);
    setShowAddModelModal(false);
    showToast(`Added ${clean}`);
    setTimeout(() => refreshSingleModel(clean), 100);
  };

  // Remove custom model
  const handleRemoveCustomModel = (modelId: string) => {
    const next = customModels.filter(m => m !== modelId);
    setCustomModels(next);
    CookieAuthManager.saveCustomModels(next);
    setSelectedModelDetails(null);
    showToast(`Removed ${modelId}`);
  };

  // Summary computations
  const summary: SystemStatusSummary = useMemo(() => {
    const total = models.length;
    const operational = models.count ? 0 : models.filter(m => m.status === 'OPERATIONAL').length;
    const degraded = models.filter(m => m.status === 'DEGRADED').length;
    const outage = models.filter(m => m.status === 'OUTAGE').length;
    const tested = models.filter(m => m.status !== 'UNTESTED');
    const avgSuccess = tested.length ? tested.reduce((acc, m) => acc + m.successRate, 0) / tested.length : 0;
    const avgLat = tested.length ? Math.round(tested.reduce((acc, m) => acc + m.latencyMs, 0) / tested.length) : 0;

    return {
      totalModels: total,
      operationalCount: operational,
      degradedCount: degraded,
      outageCount: outage,
      averageSuccessRate: avgSuccess,
      averageLatencyMs: avgLat,
      lastRefreshTime: lastRefreshTimestamp,
      activeCookieCount: cookieCount,
    };
  }, [models, lastRefreshTimestamp, cookieCount]);

  // Filtering and Sorting
  const filteredModels = useMemo(() => {
    let list = [...models];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        m =>
          m.modelId.toLowerCase().includes(q) ||
          m.modelName.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q)
      );
    }

    if (selectedFilter === 'GOOGLE') list = list.filter(m => m.provider.toLowerCase() === 'google');
    else if (selectedFilter === 'OPENAI') list = list.filter(m => m.provider.toLowerCase() === 'openai');
    else if (selectedFilter === 'ANTHROPIC') list = list.filter(m => m.provider.toLowerCase() === 'anthropic');
    else if (selectedFilter === 'DEEPSEEK') list = list.filter(m => m.provider.toLowerCase() === 'deepseek');
    else if (selectedFilter === 'ISSUES_ONLY') list = list.filter(m => m.status !== 'OPERATIONAL');

    switch (selectedSort) {
      case 'SUCCESS_RATE_DESC':
        list.sort((a, b) => b.successRate - a.successRate);
        break;
      case 'SUCCESS_RATE_ASC':
        list.sort((a, b) => a.successRate - b.successRate);
        break;
      case 'LATENCY_ASC':
        list.sort((a, b) => (a.latencyMs || 99999) - (b.latencyMs || 99999));
        break;
      case 'NAME_ASC':
        list.sort((a, b) => a.modelName.localeCompare(b.modelName));
        break;
      default:
        break;
    }

    return list;
  }, [models, searchQuery, selectedFilter, selectedSort]);

  // Generate copyable status report
  const copyStatusReport = () => {
    const lines = [
      '=== KIE Status Monitor Report (Vite) ===',
      `Timestamp: ${summary.lastRefreshTime || 'N/A'}`,
      `Total Models: ${summary.totalModels}`,
      `Operational: ${summary.operationalCount} | Degraded: ${summary.degradedCount} | Outage: ${summary.outageCount}`,
      `Average Success Rate: ${summary.averageSuccessRate.toFixed(1)}%`,
      `Average Latency: ${summary.averageLatencyMs}ms`,
      '',
      '--- Model Breakdown ---',
      ...models.map(
        m =>
          `- ${m.modelName} (${m.modelId}) [${m.provider}]: ${m.successRate.toFixed(1)}% | ${m.status} | ${m.latencyMs}ms${
            m.errorMessage ? ` (Error: ${m.errorMessage})` : ''
          }`
      ),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    showToast('Report copied to clipboard');
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#090D16] text-[#F8FAFC] pb-24 safe-bottom max-w-lg mx-auto border-x border-[#1E293B]/40 shadow-2xl">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top App Bar Header */}
      <header className="sticky top-0 z-40 bg-[#0F172A]/90 backdrop-blur-md border-b border-[#1E293B] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-3 h-3">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${
                summary.outageCount > 0 ? 'bg-red-500' : isRefreshing ? 'bg-cyan-400' : 'bg-emerald-500'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                summary.outageCount > 0 ? 'bg-red-500' : isRefreshing ? 'bg-cyan-400' : 'bg-emerald-500'
              }`}
            />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white leading-tight">KIE Status Monitor</h1>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <span className="text-emerald-400 font-medium">Vite 24H</span>
              <span>•</span>
              <span>{summary.lastRefreshTime ? `Updated ${summary.lastRefreshTime}` : 'Connecting...'}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Cookie Pill */}
          <button
            onClick={() => {
              setCookieInput(savedCookieText);
              setShowCookieModal(true);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              cookieCount > 0
                ? 'bg-emerald-950/80 border-emerald-600/40 text-emerald-300 hover:bg-emerald-900/60'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-inherit" />
            <span>{cookieCount > 0 ? `${cookieCount} Keys` : 'Cookie'}</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 active:scale-95 transition-transform"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={() => refreshAllStatus()}
            disabled={isRefreshing}
            className="p-2 text-indigo-400 hover:text-indigo-300 rounded-lg hover:bg-slate-800 active:scale-95 transition-transform disabled:opacity-50"
            title="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-3 space-y-4">
        {/* Aggregated Telemetry Dashboard Card */}
        <section className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-4 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Telemetry Overview</h2>
            </div>
            <button
              onClick={copyStatusReport}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
              title="Copy status report"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Metric Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#1E293B]/70 border border-emerald-500/30 rounded-xl p-2.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Operational</span>
              <span className="text-lg font-mono font-bold text-emerald-400">
                {summary.operationalCount}/{summary.totalModels}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {summary.averageSuccessRate.toFixed(1)}% avg
              </span>
            </div>

            <div
              className={`bg-[#1E293B]/70 border rounded-xl p-2.5 ${
                summary.outageCount > 0
                  ? 'border-red-500/40 bg-red-950/20'
                  : summary.degradedCount > 0
                  ? 'border-amber-500/40'
                  : 'border-slate-700'
              }`}
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Incidents</span>
              <span
                className={`text-lg font-mono font-bold ${
                  summary.outageCount > 0
                    ? 'text-red-400'
                    : summary.degradedCount > 0
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {summary.degradedCount + summary.outageCount}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {summary.outageCount > 0 ? `${summary.outageCount} Outages` : 'Normal'}
              </span>
            </div>

            <div className="bg-[#1E293B]/70 border border-sky-500/30 rounded-xl p-2.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Latency</span>
              <span className="text-lg font-mono font-bold text-sky-400">
                {summary.averageLatencyMs > 0 ? `${summary.averageLatencyMs}ms` : '--'}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Roundtrip</span>
            </div>
          </div>

          {/* Visual Health Multi-bar */}
          <div className="space-y-1.5">
            <div className="h-2 w-full bg-[#1E293B] rounded-full overflow-hidden flex">
              {summary.operationalCount > 0 && (
                <div
                  style={{ width: `${(summary.operationalCount / summary.totalModels) * 100}%` }}
                  className="bg-emerald-500 transition-all duration-500"
                />
              )}
              {summary.degradedCount > 0 && (
                <div
                  style={{ width: `${(summary.degradedCount / summary.totalModels) * 100}%` }}
                  className="bg-amber-500 transition-all duration-500"
                />
              )}
              {summary.outageCount > 0 && (
                <div
                  style={{ width: `${(summary.outageCount / summary.totalModels) * 100}%` }}
                  className="bg-red-500 transition-all duration-500"
                />
              )}
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 px-0.5">
              <span className="text-emerald-400">{summary.operationalCount} Operational</span>
              {summary.degradedCount > 0 && <span className="text-amber-400">{summary.degradedCount} Degraded</span>}
              {summary.outageCount > 0 && <span className="text-red-400">{summary.outageCount} Outage</span>}
            </div>
          </div>
        </section>

        {/* Search, Filter & Sort Controls */}
        <section className="space-y-2.5">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute left-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter by model name or provider..."
              className="w-full bg-[#0F172A] border border-[#334155] rounded-xl pl-9 pr-20 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <div className="absolute right-2 flex items-center gap-1">
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="p-1 text-slate-400 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <div className="relative">
                <button
                  onClick={() => setShowSortMenu(prev => !prev)}
                  className="p-1.5 text-sky-400 hover:text-sky-300 rounded-lg hover:bg-slate-800"
                  title="Sort options"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>

                {showSortMenu && (
                  <div className="absolute right-0 top-8 z-50 w-52 bg-[#1E293B] border border-[#334155] rounded-xl shadow-xl py-1 text-xs">
                    <button
                      onClick={() => {
                        setSelectedSort('DEFAULT');
                        setShowSortMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-700 text-slate-200"
                    >
                      Default Order
                    </button>
                    <button
                      onClick={() => {
                        setSelectedSort('SUCCESS_RATE_DESC');
                        setShowSortMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-700 text-slate-200"
                    >
                      Success Rate (Highest First)
                    </button>
                    <button
                      onClick={() => {
                        setSelectedSort('SUCCESS_RATE_ASC');
                        setShowSortMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-700 text-slate-200"
                    >
                      Success Rate (Lowest / Issues)
                    </button>
                    <button
                      onClick={() => {
                        setSelectedSort('LATENCY_ASC');
                        setShowSortMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-700 text-slate-200"
                    >
                      Latency (Fastest First)
                    </button>
                    <button
                      onClick={() => {
                        setSelectedSort('NAME_ASC');
                        setShowSortMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-700 text-slate-200"
                    >
                      Model Name (A-Z)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {(
              [
                { id: 'ALL', label: `All (${models.length})` },
                { id: 'GOOGLE', label: 'Google' },
                { id: 'OPENAI', label: 'OpenAI' },
                { id: 'ANTHROPIC', label: 'Anthropic' },
                { id: 'DEEPSEEK', label: 'DeepSeek' },
                {
                  id: 'ISSUES_ONLY',
                  label: `Issues (${models.filter(m => m.status !== 'OPERATIONAL' && m.status !== 'UNTESTED').length})`,
                },
              ] as const
            ).map(f => {
              const active = selectedFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setSelectedFilter(f.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
                    active
                      ? 'bg-indigo-600/30 border-indigo-400 text-indigo-300'
                      : 'bg-[#0F172A] border-[#334155] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Monitored Endpoints List */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Endpoints ({filteredModels.length})
            </span>
            <span className="text-[10px] text-slate-500">Tap card for telemetry</span>
          </div>

          {filteredModels.length === 0 ? (
            <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-8 text-center space-y-2">
              <AlertTriangle className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-300">No models found</p>
              <p className="text-xs text-slate-500">Try adjusting your filter or search query</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredModels.map(model => {
                const isOp = model.status === 'OPERATIONAL';
                const isDeg = model.status === 'DEGRADED';
                const isOut = model.status === 'OUTAGE';

                const statusColor = isOp
                  ? 'text-emerald-400'
                  : isDeg
                  ? 'text-amber-400'
                  : isOut
                  ? 'text-red-400'
                  : 'text-slate-400';
                const statusBg = isOp
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-600/40'
                  : isDeg
                  ? 'bg-amber-950/60 text-amber-300 border-amber-600/40'
                  : isOut
                  ? 'bg-red-950/60 text-red-300 border-red-600/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700';

                return (
                  <div
                    key={model.modelId}
                    onClick={() => setSelectedModelDetails(model)}
                    className="bg-[#0F172A] border border-[#1E293B] hover:border-[#334155] active:bg-[#131E35] rounded-2xl p-3.5 shadow-sm transition-all cursor-pointer space-y-3"
                  >
                    {/* Top Row: Name, Provider, Success % */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            isOp ? 'bg-emerald-500' : isDeg ? 'bg-amber-500' : isOut ? 'bg-red-500' : 'bg-slate-500'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-white truncate">{model.modelName}</span>
                            {model.isCustom && (
                              <span className="text-[9px] bg-indigo-950 text-indigo-300 border border-indigo-700 font-bold px-1.5 py-0.5 rounded">
                                CUSTOM
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-500 block truncate">
                            {model.provider} • {model.modelId}
                          </span>
                        </div>
                      </div>

                      {/* Success % pill */}
                      <div className="text-right shrink-0">
                        <span className={`text-base font-bold font-mono ${statusColor}`}>
                          {model.status === 'UNTESTED' ? '--%' : `${model.successRate.toFixed(1)}%`}
                        </span>
                        <div className="mt-0.5">
                          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${statusBg}`}>
                            {model.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Latency, Timestamp, Sparkline, Single Ping */}
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-1 text-slate-300">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-mono text-[11px]">
                            {model.latencyMs > 0 ? `${model.latencyMs}ms` : '--'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500">Updated {model.lastUpdated}</span>
                      </div>

                      {/* Sparkline & Quick Ping */}
                      <div className="flex items-center gap-2">
                        {model.historyPoints.length > 0 && (
                          <div className="flex items-end gap-0.5 h-4">
                            {model.historyPoints.slice(-6).map((pt, idx) => {
                              const barColor =
                                pt >= 90 ? 'bg-emerald-500' : pt >= 50 ? 'bg-amber-500' : 'bg-red-500';
                              return (
                                <div
                                  key={idx}
                                  style={{ height: `${Math.max(4, (pt / 100) * 16)}px` }}
                                  className={`w-1 rounded-sm ${barColor}`}
                                />
                              );
                            })}
                          </div>
                        )}

                        <button
                          onClick={e => {
                            e.stopPropagation();
                            refreshSingleModel(model.modelId);
                            showToast(`Testing ${model.modelId}...`);
                          }}
                          className="p-1 text-cyan-400 hover:text-cyan-300 hover:bg-slate-800 rounded active:scale-95"
                          title="Quick ping endpoint"
                        >
                          <Zap className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Error Banner */}
                    {model.errorMessage && model.status === 'OUTAGE' && (
                      <div className="text-[11px] bg-red-950/40 border border-red-800/50 text-red-300 px-2.5 py-1 rounded-lg truncate">
                        Error: {model.errorMessage}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Floating Add Custom Model FAB */}
      <button
        onClick={() => {
          setNewModelInput('');
          setShowAddModelModal(true);
        }}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-full flex items-center justify-center shadow-xl shadow-indigo-600/30 transition-transform"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* --- MODALS --- */}

      {/* 1. Cookie Configuration Modal */}
      {showCookieModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Cookie Authentication</h3>
              </div>
              <button onClick={() => setShowCookieModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Paste your <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-300">cookie.txt</code> (Netscape
              format) or standard <code className="bg-slate-950 px-1 py-0.5 rounded text-sky-300">cf_clearance=...; session=...</code> headers to authenticate requests:
            </p>

            <textarea
              value={cookieInput}
              onChange={e => setCookieInput(e.target.value)}
              placeholder="# Netscape HTTP Cookie File&#10;api.kie.ai&#9;TRUE&#9;/&#9;FALSE&#9;0&#9;cf_clearance&#9;xxx"
              rows={6}
              className="w-full bg-[#090D16] border border-[#334155] rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
            />

            <div className="flex items-center justify-between pt-2">
              {cookieCount > 0 ? (
                <button
                  onClick={handleClearCookie}
                  className="text-xs text-red-400 hover:text-red-300 font-semibold"
                >
                  Clear Cookies
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCookieModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveCookie(cookieInput)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30"
                >
                  Save & Connect
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Add Custom Model Modal */}
      {showAddModelModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Add Monitored Model</h3>
              </div>
              <button onClick={() => setShowAddModelModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Enter the exact model identifier from the KIE API:
            </p>

            <input
              type="text"
              value={newModelInput}
              onChange={e => setNewModelInput(e.target.value)}
              placeholder="e.g. claude-3-7-sonnet, gpt-4o, o3-mini"
              className="w-full bg-[#090D16] border border-[#334155] rounded-xl px-3 py-2.5 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />

            {/* Quick Suggestions */}
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">
                Popular Suggestions:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {['claude-3-7-sonnet', 'gemini-2.5-pro', 'gpt-4o', 'o3-mini', 'qwen-2.5-72b'].map(sugg => (
                  <button
                    key={sugg}
                    onClick={() => setNewModelInput(sugg)}
                    className="text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-md border border-slate-700"
                  >
                    + {sugg}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddModelModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddCustomModel(newModelInput)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30"
              >
                Add Endpoint
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-400" />
                <h3 className="text-base font-bold text-white">Monitor Settings</h3>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Auto refresh toggle */}
              <div className="flex items-center justify-between bg-[#0F172A] p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="font-semibold text-white block">Auto Polling</span>
                  <span className="text-[11px] text-slate-400">Stream status in background</span>
                </div>
                <input
                  type="checkbox"
                  checked={isAutoRefreshEnabled}
                  onChange={e => setIsAutoRefreshEnabled(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600"
                />
              </div>

              {/* Polling Interval */}
              <div className="bg-[#0F172A] p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Refresh Frequency</span>
                  <span className="font-mono text-indigo-400">{autoRefreshInterval} seconds</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[15, 30, 45, 60].map(sec => (
                    <button
                      key={sec}
                      onClick={() => {
                        setAutoRefreshInterval(sec);
                        CookieAuthManager.saveInterval(sec);
                      }}
                      className={`py-1.5 rounded-lg text-xs font-mono font-semibold border ${
                        autoRefreshInterval === sec
                          ? 'bg-indigo-600 border-indigo-400 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Model Details Diagnostics Modal */}
      {selectedModelDetails && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1E293B] border border-[#334155] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">{selectedModelDetails.modelName}</h3>
                <p className="text-xs font-mono text-slate-400">{selectedModelDetails.modelId}</p>
              </div>
              <button onClick={() => setSelectedModelDetails(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#090D16] p-3.5 rounded-xl border border-slate-800 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Provider:</span>
                <span className="font-semibold text-white">{selectedModelDetails.provider}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Success Rate:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {selectedModelDetails.successRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Latency:</span>
                <span className="font-mono text-sky-400">{selectedModelDetails.latencyMs}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Last Telemetry:</span>
                <span className="text-slate-300">{selectedModelDetails.lastUpdated}</span>
              </div>
              {selectedModelDetails.errorMessage && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-red-400 block font-semibold mb-1">Diagnostic Error:</span>
                  <p className="text-[11px] font-mono text-red-300 bg-red-950/40 p-2 rounded-lg border border-red-800">
                    {selectedModelDetails.errorMessage}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              {selectedModelDetails.isCustom ? (
                <button
                  onClick={() => handleRemoveCustomModel(selectedModelDetails.modelId)}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Custom</span>
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    refreshSingleModel(selectedModelDetails.modelId);
                    showToast(`Pinged ${selectedModelDetails.modelId}`);
                  }}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Ping Endpoint</span>
                </button>
                <button
                  onClick={() => setSelectedModelDetails(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
