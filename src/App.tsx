import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Activity,
  RefreshCw,
  AlertTriangle,
  Clock,
  Search,
  SlidersHorizontal,
  Plus,
  Trash2,
  Copy,
  Check,
  KeyRound,
  ChevronRight,
  Zap,
  ArrowDown
} from 'lucide-react';
import { ModelHealth, HealthStatus, ModelFilter, SortOption, SystemStatusSummary } from './types';
import { kieService, DEFAULT_MODELS, DEFAULT_BUILTIN_COOKIE } from './services/kieService';
import { DraggableSheet } from './components/DraggableSheet';

export const App: React.FC = () => {
  const [models, setModels] = useState<ModelHealth[]>([]);
  const [customModels, setCustomModels] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<ModelFilter>('ALL');
  const [selectedSort, setSelectedSort] = useState<SortOption>('DEFAULT');
  const [cookieCount, setCookieCount] = useState<number>(kieService.getCookieCount());
  const [rawCookieInput, setRawCookieInput] = useState<string>(DEFAULT_BUILTIN_COOKIE);
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState<boolean>(true);
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState<number>(45);
  const [countdown, setCountdown] = useState<number>(45);
  const [selectedModel, setSelectedModel] = useState<ModelHealth | null>(null);

  // Modals
  const [showCookieModal, setShowCookieModal] = useState<boolean>(false);
  const [showAddModelModal, setShowAddModelModal] = useState<boolean>(false);
  const [newModelInput, setNewModelInput] = useState<string>('');
  const [showSortModal, setShowSortModal] = useState<boolean>(false);
  const [showAutoRefreshModal, setShowAutoRefreshModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pull to refresh states
  const [pullDistance, setPullDistance] = useState<number>(0);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const pullStartYRef = useRef<number>(0);

  const historyMapRef = useRef<Map<string, number[]>>(new Map());

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Initial load
  useEffect(() => {
    const allIds = Array.from(new Set([...DEFAULT_MODELS, ...customModels]));
    const initialList: ModelHealth[] = allIds.map(id => ({
      modelId: id,
      modelName: kieService.formatModelName(id),
      provider: kieService.determineProvider(id),
      successRate: 0,
      status: 'DEGRADED',
      latencyMs: 0,
      lastUpdated: 'Pending...',
      historyPoints: [],
      isCustom: !DEFAULT_MODELS.includes(id)
    }));
    setModels(initialList);
  }, []);

  // Fetch all models
  const refreshAllModels = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    const allIds = Array.from(new Set([...DEFAULT_MODELS, ...customModels]));
    const results: ModelHealth[] = [];

    // Parallel fetch
    const promises = allIds.map(async id => {
      const existingHistory = historyMapRef.current.get(id) || [];
      const health = await kieService.fetchModelHealth(id, existingHistory);
      historyMapRef.current.set(id, health.historyPoints);
      return health;
    });

    const settled = await Promise.allSettled(promises);
    for (const res of settled) {
      if (res.status === 'fulfilled') {
        results.push(res.value);
      }
    }

    setModels(results);
    setIsRefreshing(false);
    setCountdown(autoRefreshSeconds);
  }, [customModels, isRefreshing, autoRefreshSeconds]);

  // Initial fetch once
  useEffect(() => {
    refreshAllModels();
  }, [refreshAllModels]);

  // Auto-refresh countdown timer
  useEffect(() => {
    if (!isAutoRefreshEnabled) return;

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          refreshAllModels();
          return autoRefreshSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isAutoRefreshEnabled, autoRefreshSeconds, refreshAllModels]);

  // Pull to refresh touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      pullStartYRef.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - pullStartYRef.current;
    if (delta > 0 && window.scrollY === 0) {
      // Apply rubber band resistance
      setPullDistance(Math.min(100, delta * 0.45));
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling) return;
    setIsPulling(false);
    if (pullDistance > 55 && !isRefreshing) {
      refreshAllModels();
    }
    setPullDistance(0);
  };

  // Refresh single model
  const refreshSingle = async (modelId: string) => {
    const existingHistory = historyMapRef.current.get(modelId) || [];
    const updated = await kieService.fetchModelHealth(modelId, existingHistory);
    historyMapRef.current.set(modelId, updated.historyPoints);

    setModels(prev => prev.map(m => (m.modelId === modelId ? updated : m)));
    if (selectedModel?.modelId === modelId) {
      setSelectedModel(updated);
    }
    showToast(`Refreshed ${modelId}`);
  };

  // Add custom model
  const handleAddCustomModel = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newModelInput.trim().toLowerCase();
    if (!trimmed) return;

    if (DEFAULT_MODELS.includes(trimmed) || customModels.includes(trimmed)) {
      showToast('Model already in list');
      return;
    }

    setCustomModels(prev => [...prev, trimmed]);
    setNewModelInput('');
    setShowAddModelModal(false);
    showToast(`Added ${trimmed}`);
  };

  // Remove custom model
  const handleRemoveCustomModel = (modelId: string) => {
    setCustomModels(prev => prev.filter(id => id !== modelId));
    setModels(prev => prev.filter(m => m.modelId !== modelId));
    if (selectedModel?.modelId === modelId) {
      setSelectedModel(null);
    }
    showToast(`Removed ${modelId}`);
  };

  // Apply cookie
  const handleSaveCookie = () => {
    const count = kieService.setCookieFromRawText(rawCookieInput);
    setCookieCount(count);
    setShowCookieModal(false);
    showToast(`Saved ${count} active cookie tokens`);
    refreshAllModels();
  };

  const handleClearCookie = () => {
    kieService.clearCookies();
    setCookieCount(0);
    setRawCookieInput('');
    setShowCookieModal(false);
    showToast('Cookies cleared');
    refreshAllModels();
  };

  // Copy status report
  const copyStatusReport = () => {
    const lines = [
      `KIE AI Models Health Report (${new Date().toLocaleTimeString()})`,
      `Overall System Availability: ${summary.averageSuccessRate.toFixed(1)}%`,
      `Operational: ${summary.operationalCount} | Degraded: ${summary.degradedCount} | Outages: ${summary.outageCount}`,
      '----------------------------------------',
      ...models.map(m => `[${m.status.padEnd(11)}] ${m.modelId.padEnd(22)}: ${m.successRate.toFixed(1)}% (${m.latencyMs}ms)`)
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    showToast('Status report copied to clipboard');
  };

  // Filtered & Sorted models
  const filteredModels = useMemo(() => {
    let list = [...models];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        m =>
          m.modelId.toLowerCase().includes(q) ||
          m.modelName.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q)
      );
    }

    // Filter
    switch (selectedFilter) {
      case 'GOOGLE':
        list = list.filter(m => m.provider.toLowerCase().includes('google'));
        break;
      case 'OPENAI':
        list = list.filter(m => m.provider.toLowerCase().includes('openai'));
        break;
      case 'ANTHROPIC':
        list = list.filter(m => m.provider.toLowerCase().includes('anthropic'));
        break;
      case 'DEEPSEEK':
        list = list.filter(m => m.provider.toLowerCase().includes('deepseek'));
        break;
      case 'ISSUES_ONLY':
        list = list.filter(m => m.status !== 'OPERATIONAL');
        break;
      default:
        break;
    }

    // Sort
    switch (selectedSort) {
      case 'SUCCESS_RATE_DESC':
        list.sort((a, b) => b.successRate - a.successRate);
        break;
      case 'SUCCESS_RATE_ASC':
        list.sort((a, b) => a.successRate - b.successRate);
        break;
      case 'LATENCY_ASC':
        list.sort((a, b) => (a.latencyMs || 9999) - (b.latencyMs || 9999));
        break;
      case 'NAME_ASC':
        list.sort((a, b) => a.modelName.localeCompare(b.modelName));
        break;
      default:
        break;
    }

    return list;
  }, [models, searchQuery, selectedFilter, selectedSort]);

  // Status Summary
  const summary: SystemStatusSummary = useMemo(() => {
    let operational = 0;
    let degraded = 0;
    let outage = 0;
    let totalRate = 0;
    let totalLatency = 0;
    let validLatencyCount = 0;

    for (const m of models) {
      if (m.status === 'OPERATIONAL') operational++;
      else if (m.status === 'DEGRADED') degraded++;
      else outage++;

      totalRate += m.successRate;
      if (m.latencyMs > 0) {
        totalLatency += m.latencyMs;
        validLatencyCount++;
      }
    }

    const count = models.length || 1;
    return {
      totalModels: models.length,
      operationalCount: operational,
      degradedCount: degraded,
      outageCount: outage,
      averageSuccessRate: totalRate / count,
      averageLatencyMs: validLatencyCount > 0 ? Math.round(totalLatency / validLatencyCount) : 0,
      lastRefreshTime: new Date().toLocaleTimeString(),
      activeCookieCount: cookieCount
    };
  }, [models, cookieCount]);

  const getStatusColor = (status: HealthStatus) => {
    switch (status) {
      case 'OPERATIONAL':
        return {
          badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-400 shadow-emerald-400/50',
          text: 'text-emerald-400'
        };
      case 'DEGRADED':
        return {
          badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          dot: 'bg-amber-400 shadow-amber-400/50',
          text: 'text-amber-400'
        };
      case 'OUTAGE':
        return {
          badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
          dot: 'bg-rose-400 shadow-rose-400/50',
          text: 'text-rose-400'
        };
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen bg-[#0a0d14] text-slate-100 flex flex-col font-sans pb-20 select-none overflow-x-hidden"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-cyan-500/40 text-cyan-300 text-xs px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2 animate-bounce">
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Pull to refresh visual indicator */}
      {pullDistance > 0 && (
        <div
          className="w-full flex items-center justify-center transition-transform"
          style={{ height: `${pullDistance}px`, opacity: pullDistance / 60 }}
        >
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-400 bg-slate-900/90 px-3.5 py-1.5 rounded-full border border-cyan-500/30 shadow-lg">
            <ArrowDown
              className={`w-4 h-4 transition-transform duration-200 ${
                pullDistance > 55 ? 'rotate-180 text-emerald-400' : ''
              }`}
            />
            <span>{pullDistance > 55 ? 'Release to refresh' : 'Pull down to refresh'}</span>
          </div>
        </div>
      )}

      {/* Sticky Top Header */}
      <header className="sticky top-0 z-30 bg-[#0d121f]/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Activity className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                  KIE Status
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    24H
                  </span>
                </h1>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                {isRefreshing ? (
                  <span className="text-cyan-400 animate-pulse">Syncing endpoints...</span>
                ) : (
                  <span>Next sync in {countdown}s</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Auto refresh countdown badge button */}
            <button
              onClick={() => setShowAutoRefreshModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-mono flex items-center gap-1.5 border border-slate-700/60 active:scale-95 transition-all"
            >
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isAutoRefreshEnabled ? `${countdown}s` : 'PAUSED'}</span>
            </button>

            {/* Cookie modal button */}
            <button
              onClick={() => setShowCookieModal(true)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border active:scale-95 transition-all ${
                cookieCount > 0
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700/60'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span className="font-mono">{cookieCount}</span>
            </button>

            {/* Manual Sync button */}
            <button
              onClick={() => refreshAllModels()}
              disabled={isRefreshing}
              className="p-2 rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 active:scale-95 transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 stroke-[2.5] ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-3 space-y-4 max-w-md mx-auto w-full">
        {/* System Health Summary Card */}
        <section className="p-4 rounded-2xl bg-gradient-to-br from-[#121927] to-[#0c101b] border border-slate-800/80 shadow-xl space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-300">Overall Availability</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                {models.length} Models
              </span>
            </div>
            <button
              onClick={copyStatusReport}
              className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              <Copy className="w-3 h-3" />
              Share Report
            </button>
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-3xl font-extrabold font-mono tracking-tight text-white flex items-baseline gap-1">
                {summary.averageSuccessRate.toFixed(1)}
                <span className="text-base font-normal text-slate-400">%</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Avg Latency: <strong className="text-slate-200">{summary.averageLatencyMs}ms</strong>
              </p>
            </div>

            <div className="flex items-center gap-1 text-xs">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-mono font-semibold border border-emerald-500/20">
                {summary.operationalCount} OK
              </span>
              {summary.degradedCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 font-mono font-semibold border border-amber-500/20">
                  {summary.degradedCount} Deg
                </span>
              )}
              {summary.outageCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 font-mono font-semibold border border-rose-500/20">
                  {summary.outageCount} Down
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-400 h-full transition-all duration-500"
              style={{ width: `${(summary.operationalCount / (models.length || 1)) * 100}%` }}
            />
            <div
              className="bg-amber-400 h-full transition-all duration-500"
              style={{ width: `${(summary.degradedCount / (models.length || 1)) * 100}%` }}
            />
            <div
              className="bg-rose-400 h-full transition-all duration-500"
              style={{ width: `${(summary.outageCount / (models.length || 1)) * 100}%` }}
            />
          </div>
        </section>

        {/* Search, Filter & Action Toolbar */}
        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search models, providers..."
                className="w-full pl-8.5 pr-3 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowSortModal(true)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white active:scale-95"
              aria-label="Sort"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowAddModelModal(true)}
              className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 active:scale-95"
              aria-label="Add Model"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Provider Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'GOOGLE', label: 'Google' },
              { id: 'OPENAI', label: 'OpenAI' },
              { id: 'ANTHROPIC', label: 'Anthropic' },
              { id: 'DEEPSEEK', label: 'DeepSeek' },
              { id: 'ISSUES_ONLY', label: 'Issues Only' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedFilter(tab.id as ModelFilter)}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  selectedFilter === tab.id
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-900/80 text-slate-400 border border-slate-800/80 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {/* Model Cards List */}
        <div className="space-y-2.5">
          {filteredModels.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800/60 text-slate-500 text-xs">
              No models match current search filter
            </div>
          ) : (
            filteredModels.map(model => {
              const colors = getStatusColor(model.status);
              return (
                <div
                  key={model.modelId}
                  onClick={() => setSelectedModel(model)}
                  className="group relative p-3.5 rounded-2xl bg-[#101624] border border-slate-800/70 hover:border-slate-700 active:scale-[0.99] transition-all cursor-pointer shadow-lg hover:shadow-cyan-950/20"
                >
                  {/* Top Row: Provider badge, Model name, Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded bg-slate-800/80 text-slate-400">
                          {model.provider}
                        </span>
                        <h3 className="text-xs font-bold text-white truncate">{model.modelName}</h3>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">{model.modelId}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-bold font-mono text-white flex items-center justify-end gap-1">
                          {model.successRate.toFixed(1)}%
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${colors.text}`}>
                          {model.status}
                        </span>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${colors.dot} shadow-sm animate-pulse`} />
                    </div>
                  </div>

                  {/* Bottom Row: Latency, Sparkline, Last Updated */}
                  <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-400 font-mono">
                      <Activity className="w-3.5 h-3.5 text-slate-500" />
                      <span>{model.latencyMs > 0 ? `${model.latencyMs}ms` : '---'}</span>
                    </div>

                    {/* Sparkline mini */}
                    {model.historyPoints.length > 1 && (
                      <div className="flex items-end gap-0.5 h-3.5 w-16">
                        {model.historyPoints.slice(-8).map((point, idx) => (
                          <div
                            key={idx}
                            className={`w-1.5 rounded-t-sm ${
                              point >= 90 ? 'bg-emerald-400/80' : point >= 50 ? 'bg-amber-400/80' : 'bg-rose-400/80'
                            }`}
                            style={{ height: `${Math.max(2, (point / 100) * 14)}px` }}
                          />
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-1 font-mono text-slate-500">
                      <span>{model.lastUpdated}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Model Details Draggable Bottom Sheet */}
      <DraggableSheet
        isOpen={!!selectedModel}
        onClose={() => setSelectedModel(null)}
        title={
          selectedModel && (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                  {selectedModel.provider}
                </span>
                <h2 className="text-base font-bold text-white truncate">{selectedModel.modelName}</h2>
              </div>
              <p className="text-xs font-mono text-slate-400 mt-0.5 truncate">{selectedModel.modelId}</p>
            </div>
          )
        }
      >
        {selectedModel && (
          <div className="space-y-4">
            {/* Status grid */}
            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-400 block">Status</span>
                <span className={`text-sm font-bold uppercase ${getStatusColor(selectedModel.status).text}`}>
                  {selectedModel.status}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Success Rate</span>
                <span className="text-sm font-mono font-bold text-white">
                  {selectedModel.successRate.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Response Latency</span>
                <span className="text-sm font-mono font-bold text-white">
                  {selectedModel.latencyMs}ms
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Last Check</span>
                <span className="text-sm font-mono text-slate-300">
                  {selectedModel.lastUpdated}
                </span>
              </div>
            </div>

            {/* Error banner if any */}
            {selectedModel.errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <span className="font-semibold block">Endpoint Message:</span>
                  <p className="font-mono text-[11px] text-rose-200">{selectedModel.errorMessage}</p>
                </div>
              </div>
            )}

            {/* 24H Sparkline / History */}
            {selectedModel.historyPoints.length > 0 && (
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Recent Check History</span>
                  <span className="text-cyan-400 font-mono text-[11px]">{selectedModel.historyPoints.length} buckets</span>
                </div>
                <div className="flex items-end gap-1.5 h-16 pt-2">
                  {selectedModel.historyPoints.map((pt, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group/bar relative">
                      <div
                        className={`w-full rounded-t-sm transition-all ${
                          pt >= 90 ? 'bg-emerald-400' : pt >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                        }`}
                        style={{ height: `${Math.max(4, (pt / 100) * 48)}px` }}
                      />
                      <div className="opacity-0 group-hover/bar:opacity-100 absolute -top-6 bg-slate-950 px-1.5 py-0.5 rounded text-[9px] font-mono text-white pointer-events-none transition-opacity">
                        {pt.toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Monitoring URL */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-300">Monitoring URL</span>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-cyan-300 break-all select-all">
                https://api.kie.ai/api/v1/monitor/success-rate?model={selectedModel.modelId}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => refreshSingle(selectedModel.modelId)}
                className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Test Endpoint
              </button>

              {selectedModel.isCustom && (
                <button
                  onClick={() => handleRemoveCustomModel(selectedModel.modelId)}
                  className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              )}
            </div>
          </div>
        )}
      </DraggableSheet>

      {/* Cookie Authentication Draggable Bottom Sheet */}
      <DraggableSheet
        isOpen={showCookieModal}
        onClose={() => setShowCookieModal(false)}
        icon={<KeyRound className="w-4 h-4 text-cyan-400" />}
        title="Cookie Authentication"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            Paste your Netscape <code className="text-cyan-300">cookie.txt</code> or standard HTTP <code className="text-cyan-300">name=value;</code> string. Stored strictly in memory.
          </p>

          <textarea
            value={rawCookieInput}
            onChange={e => setRawCookieInput(e.target.value)}
            placeholder="# Netscape HTTP Cookie File&#10;.google.com&#9;TRUE&#9;/&#9;TRUE&#9;1795024725&#9;SID&#9;ABC123...&#10;&#10;or: key=value; session_id=xyz;"
            className="w-full h-32 bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none"
          />

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Active tokens: <strong className="text-white font-mono">{cookieCount}</strong></span>
            {cookieCount > 0 && (
              <button onClick={handleClearCookie} className="text-rose-400 hover:underline">
                Clear cookies
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => setShowCookieModal(false)}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCookie}
              className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20"
            >
              Apply Cookies
            </button>
          </div>
        </div>
      </DraggableSheet>

      {/* Add Custom Model Draggable Bottom Sheet */}
      <DraggableSheet
        isOpen={showAddModelModal}
        onClose={() => setShowAddModelModal(false)}
        icon={<Plus className="w-4 h-4 text-cyan-400" />}
        title="Add Custom Model"
      >
        <form onSubmit={handleAddCustomModel} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-400">Model ID</label>
            <input
              type="text"
              value={newModelInput}
              onChange={e => setNewModelInput(e.target.value)}
              placeholder="e.g. gpt-4o, claude-3-7-sonnet"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddModelModal(false)}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20"
            >
              Add & Monitor
            </button>
          </div>
        </form>
      </DraggableSheet>

      {/* Auto-Refresh Settings Draggable Bottom Sheet */}
      <DraggableSheet
        isOpen={showAutoRefreshModal}
        onClose={() => setShowAutoRefreshModal(false)}
        icon={<Clock className="w-4 h-4 text-cyan-400" />}
        title="Auto-Refresh Interval"
      >
        <div className="space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-xs font-medium text-slate-200">Enable Automatic Polling</span>
            <button
              onClick={() => setIsAutoRefreshEnabled(!isAutoRefreshEnabled)}
              className={`w-11 h-6 rounded-full p-1 transition-colors ${
                isAutoRefreshEnabled ? 'bg-cyan-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  isAutoRefreshEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Intervals */}
          <div className="space-y-1.5">
            <span className="text-xs text-slate-400">Interval duration</span>
            <div className="grid grid-cols-4 gap-2">
              {[15, 30, 45, 60].map(sec => (
                <button
                  key={sec}
                  onClick={() => {
                    setAutoRefreshSeconds(sec);
                    setCountdown(sec);
                    setShowAutoRefreshModal(false);
                    showToast(`Interval set to ${sec}s`);
                  }}
                  className={`py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                    autoRefreshSeconds === sec
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>
        </div>
      </DraggableSheet>

      {/* Sort Draggable Bottom Sheet */}
      <DraggableSheet
        isOpen={showSortModal}
        onClose={() => setShowSortModal(false)}
        icon={<SlidersHorizontal className="w-4 h-4 text-cyan-400" />}
        title="Sort Models By"
      >
        <div className="space-y-2">
          {[
            { id: 'DEFAULT', label: 'Default Order' },
            { id: 'SUCCESS_RATE_DESC', label: 'Highest Success Rate' },
            { id: 'SUCCESS_RATE_ASC', label: 'Lowest Success Rate' },
            { id: 'LATENCY_ASC', label: 'Lowest Latency (Fastest)' },
            { id: 'NAME_ASC', label: 'Alphabetical (A-Z)' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => {
                setSelectedSort(item.id as SortOption);
                setShowSortModal(false);
              }}
              className={`w-full p-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                selectedSort === item.id
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                  : 'bg-slate-900 text-slate-300 border border-slate-800/80 hover:bg-slate-800'
              }`}
            >
              <span>{item.label}</span>
              {selectedSort === item.id && <Check className="w-4 h-4 text-cyan-400" />}
            </button>
          ))}
        </div>
      </DraggableSheet>
    </div>
  );
};

export default App;
