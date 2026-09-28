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
  TrendingUp,
  Sparkles,
  Zap,
  X
} from 'lucide-react';
import { ModelHealth, HealthStatus, ModelFilter, SortOption, SystemStatusSummary } from './types';
import { kieService, DEFAULT_MODELS, DEFAULT_BUILTIN_COOKIE } from './services/kieService';

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

    for (const id of allIds) {
      const currentHistory = historyMapRef.current.get(id) || [];
      const health = await kieService.fetchModelHealth(id, currentHistory);
      historyMapRef.current.set(id, health.historyPoints);
      results.push(health);
    }

    setModels(results);
    setIsRefreshing(false);
    setCountdown(autoRefreshSeconds);

    if (selectedModel) {
      const updated = results.find(m => m.modelId === selectedModel.modelId);
      if (updated) setSelectedModel(updated);
    }
  }, [isRefreshing, customModels, autoRefreshSeconds, selectedModel]);

  // Initial refresh trigger
  useEffect(() => {
    refreshAllModels();
  }, [customModels]);

  // Auto-refresh countdown timer
  useEffect(() => {
    if (!isAutoRefreshEnabled) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          refreshAllModels();
          return autoRefreshSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAutoRefreshEnabled, autoRefreshSeconds, refreshAllModels]);

  // Single model refresh
  const refreshSingle = async (modelId: string) => {
    const currentHistory = historyMapRef.current.get(modelId) || [];
    const health = await kieService.fetchModelHealth(modelId, currentHistory);
    historyMapRef.current.set(modelId, health.historyPoints);

    setModels(prev => prev.map(m => (m.modelId === modelId ? health : m)));
    if (selectedModel?.modelId === modelId) {
      setSelectedModel(health);
    }
    showToast(`Updated ${health.modelName}`);
  };

  // Add custom model
  const handleAddCustomModel = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newModelInput.trim().toLowerCase();
    if (!trimmed) return;

    if (DEFAULT_MODELS.includes(trimmed) || customModels.includes(trimmed)) {
      showToast('Model already exists');
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
    historyMapRef.current.delete(modelId);
    setModels(prev => prev.filter(m => m.modelId !== modelId));
    if (selectedModel?.modelId === modelId) {
      setSelectedModel(null);
    }
    showToast(`Removed ${modelId}`);
  };

  // Cookie save
  const handleSaveCookie = () => {
    const count = kieService.setCookieFromRawText(rawCookieInput);
    setCookieCount(count);
    setShowCookieModal(false);
    showToast(count > 0 ? `Loaded ${count} active cookie tokens` : 'No valid cookies found');
    refreshAllModels();
  };

  const handleClearCookie = () => {
    kieService.clearCookies();
    setCookieCount(0);
    setRawCookieInput('');
    setShowCookieModal(false);
    showToast('Cleared cookies');
    refreshAllModels();
  };

  // System summary
  const summary: SystemStatusSummary = useMemo(() => {
    const total = models.length;
    if (total === 0) {
      return {
        totalModels: 0,
        operationalCount: 0,
        degradedCount: 0,
        outageCount: 0,
        averageSuccessRate: 0,
        averageLatencyMs: 0,
        lastRefreshTime: '',
        activeCookieCount: cookieCount
      };
    }

    const op = models.filter(m => m.status === 'OPERATIONAL').length;
    const deg = models.filter(m => m.status === 'DEGRADED').length;
    const out = models.filter(m => m.status === 'OUTAGE').length;
    const active = models.filter(m => m.status !== 'OUTAGE' || m.latencyMs > 0);
    const avgRate = active.length > 0 ? active.reduce((acc, m) => acc + m.successRate, 0) / active.length : 0;
    const avgLat = active.length > 0 ? Math.round(active.reduce((acc, m) => acc + m.latencyMs, 0) / active.length) : 0;

    return {
      totalModels: total,
      operationalCount: op,
      degradedCount: deg,
      outageCount: out,
      averageSuccessRate: avgRate,
      averageLatencyMs: avgLat,
      lastRefreshTime: models[0]?.lastUpdated || '',
      activeCookieCount: cookieCount
    };
  }, [models, cookieCount]);

  // Filtered and sorted models
  const displayedModels = useMemo(() => {
    let list = [...models];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(m => m.modelId.toLowerCase().includes(q) || m.modelName.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q));
    }

    // Filter
    if (selectedFilter === 'GOOGLE') list = list.filter(m => m.provider === 'Google');
    else if (selectedFilter === 'OPENAI') list = list.filter(m => m.provider === 'OpenAI');
    else if (selectedFilter === 'ANTHROPIC') list = list.filter(m => m.provider === 'Anthropic');
    else if (selectedFilter === 'DEEPSEEK') list = list.filter(m => m.provider === 'DeepSeek');
    else if (selectedFilter === 'ISSUES_ONLY') list = list.filter(m => m.status !== 'OPERATIONAL');

    // Sort
    if (selectedSort === 'SUCCESS_RATE_DESC') list.sort((a, b) => b.successRate - a.successRate);
    else if (selectedSort === 'SUCCESS_RATE_ASC') list.sort((a, b) => a.successRate - b.successRate);
    else if (selectedSort === 'LATENCY_ASC') list.sort((a, b) => a.latencyMs - b.latencyMs);
    else if (selectedSort === 'NAME_ASC') list.sort((a, b) => a.modelName.localeCompare(b.modelName));

    return list;
  }, [models, searchQuery, selectedFilter, selectedSort]);

  // Copy report
  const handleCopyReport = () => {
    let text = `=== KIE Status Monitor Report ===\n`;
    text += `Time: ${new Date().toLocaleString()}\n`;
    text += `Total Models: ${summary.totalModels} | Operational: ${summary.operationalCount} | Degraded: ${summary.degradedCount} | Outages: ${summary.outageCount}\n`;
    text += `Average Success Rate: ${summary.averageSuccessRate.toFixed(1)}%\n`;
    text += `Average Latency: ${summary.averageLatencyMs}ms\n\n`;
    text += `Models Breakdown:\n`;
    for (const m of models) {
      text += `- ${m.modelName} (${m.modelId}) [${m.provider}]: ${m.successRate.toFixed(1)}% | ${m.status} | ${m.latencyMs}ms\n`;
    }

    navigator.clipboard.writeText(text);
    showToast('Copied status report to clipboard');
  };

  const getStatusColor = (status: HealthStatus) => {
    switch (status) {
      case 'OPERATIONAL':
        return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: 'bg-emerald-400' };
      case 'DEGRADED':
        return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: 'bg-amber-400' };
      case 'OUTAGE':
        return { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', dot: 'bg-rose-400' };
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F19] text-slate-100 max-w-md mx-auto relative overflow-hidden pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 inset-x-4 max-w-xs mx-auto z-50 bg-slate-800 text-slate-100 px-4 py-3 rounded-xl shadow-2xl border border-slate-700/80 flex items-center justify-between gap-3 text-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="font-medium">{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Mobile App Bar */}
      <header className="sticky top-0 z-30 bg-[#0B0F19]/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-bold tracking-tight text-white">KIE Status</h1>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-[11px] text-slate-400 font-mono">Real-time API Monitor</p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2">
          {/* Cookie auth button */}
          <button
            onClick={() => setShowCookieModal(true)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              cookieCount > 0
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-800/80 text-slate-300 border border-slate-700/60 hover:bg-slate-700/60'
            }`}
            title="Cookie Authentication"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span className="font-mono text-[11px]">{cookieCount > 0 ? `${cookieCount} auth` : 'Auth'}</span>
          </button>

          {/* Refresh button */}
          <button
            onClick={refreshAllModels}
            disabled={isRefreshing}
            className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-200 flex items-center justify-center hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-50"
            title="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* Auto-Refresh Bar */}
      <div className="bg-slate-900/60 border-b border-slate-800/50 px-4 py-2 flex items-center justify-between text-xs text-slate-400">
        <button
          onClick={() => setShowAutoRefreshModal(true)}
          className="flex items-center gap-1.5 hover:text-slate-200 transition-colors"
        >
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            {isAutoRefreshEnabled ? `Auto-refresh in ${countdown}s (${autoRefreshSeconds}s)` : 'Auto-refresh paused'}
          </span>
        </button>
        <div className="flex items-center gap-2">
          <button onClick={handleCopyReport} className="text-slate-400 hover:text-cyan-300 transition-colors p-1" title="Copy Report">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowAddModelModal(true)} className="text-slate-400 hover:text-cyan-300 transition-colors p-1" title="Add Model">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-3 space-y-3.5">
        {/* System Overview Dashboard Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-[#131b2c] to-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Gateway Health</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {summary.lastRefreshTime ? `Updated ${summary.lastRefreshTime}` : 'Syncing...'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <span className="block text-xl font-extrabold text-emerald-400">{summary.operationalCount}</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-300/80">Online</span>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
              <span className="block text-xl font-extrabold text-amber-400">{summary.degradedCount}</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-amber-300/80">Degraded</span>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
              <span className="block text-xl font-extrabold text-rose-400">{summary.outageCount}</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-rose-300/80">Outages</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-400">Avg Success:</span>
              <span className="font-mono font-bold text-white">{summary.averageSuccessRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">Latency:</span>
              <span className="font-mono font-bold text-white">{summary.averageLatencyMs}ms</span>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search models (e.g. flash, gpt, r1)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowSortModal(true)}
              className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-cyan-300"
              title="Sort Options"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Filter Horizontal Scroll */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {(['ALL', 'GOOGLE', 'OPENAI', 'ANTHROPIC', 'DEEPSEEK', 'ISSUES_ONLY'] as ModelFilter[]).map(filter => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold tracking-wide whitespace-nowrap transition-all ${
                  selectedFilter === filter
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900/90 text-slate-400 border border-slate-800/80 hover:bg-slate-800'
                }`}
              >
                {filter === 'ALL' ? 'All Models' : filter.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Models List */}
        <div className="space-y-2.5">
          {displayedModels.length === 0 ? (
            <div className="py-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/60 p-6 space-y-2">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto opacity-80" />
              <p className="text-sm font-semibold text-slate-300">No models match your filter</p>
              <p className="text-xs text-slate-500">Try changing your search term or filter selection.</p>
            </div>
          ) : (
            displayedModels.map(model => {
              const colors = getStatusColor(model.status);

              return (
                <div
                  key={model.modelId}
                  onClick={() => setSelectedModel(model)}
                  className="p-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800/80 border border-slate-800/80 transition-all cursor-pointer active:scale-[0.99] shadow-sm space-y-2.5 group"
                >
                  {/* Top Row: Provider badge, Model Name, and Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-slate-800 text-cyan-400 border border-slate-700/60">
                          {model.provider}
                        </span>
                        {model.isCustom && (
                          <span className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Custom
                          </span>
                        )}
                        <h3 className="text-sm font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                          {model.modelName}
                        </h3>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 truncate">{model.modelId}</p>
                    </div>

                    {/* Health Status Pill */}
                    <div className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${colors.bg} ${colors.border}`}>
                      <span className={`w-2 h-2 rounded-full ${colors.dot} animate-pulse`} />
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${colors.text}`}>
                        {model.status}
                      </span>
                    </div>
                  </div>

                  {/* Middle Row: Success Rate Bar & Sparkline */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400 text-[11px]">Availability (24h)</span>
                      <span className="font-bold text-slate-100">{model.successRate.toFixed(1)}%</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          model.successRate >= 90
                            ? 'bg-emerald-400'
                            : model.successRate >= 50
                            ? 'bg-amber-400'
                            : 'bg-rose-400'
                        }`}
                        style={{ width: `${Math.max(4, model.successRate)}%` }}
                      />
                    </div>
                  </div>

                  {/* Bottom Row: Latency, Sparkline Mini, Last Updated */}
                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5 font-mono">
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

      {/* Model Details Bottom Sheet Modal */}
      {selectedModel && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center animate-fade-in">
          <div className="bg-[#111827] border-t border-slate-700/80 w-full max-w-md rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto" />

            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                    {selectedModel.provider}
                  </span>
                  <h2 className="text-lg font-bold text-white">{selectedModel.modelName}</h2>
                </div>
                <p className="text-xs font-mono text-slate-400 mt-0.5">{selectedModel.modelId}</p>
              </div>

              <button
                onClick={() => setSelectedModel(null)}
                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status card */}
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

            {/* API Endpoint details */}
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
        </div>
      )}

      {/* Cookie Authentication Modal */}
      {showCookieModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#111827] border border-slate-700/80 w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Cookie Authentication</h3>
              </div>
              <button onClick={() => setShowCookieModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

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
                className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCookie}
                className="flex-1 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20"
              >
                Apply Cookies
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Model Modal */}
      {showAddModelModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <form onSubmit={handleAddCustomModel} className="bg-[#111827] border border-slate-700/80 w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Add Custom Model</h3>
              </div>
              <button type="button" onClick={() => setShowAddModelModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

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
                className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20"
              >
                Add & Monitor
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Auto-Refresh Settings Modal */}
      {showAutoRefreshModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#111827] border border-slate-700/80 w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Auto-Refresh Interval</h3>
              </div>
              <button onClick={() => setShowAutoRefreshModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

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
        </div>
      )}

      {/* Sort Modal */}
      {showSortModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center p-4 animate-fade-in">
          <div className="bg-[#111827] border border-slate-700/80 w-full max-w-sm rounded-2xl p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-sm font-bold text-white">Sort Models By</h3>
              <button onClick={() => setShowSortModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {[
              { id: 'DEFAULT', label: 'Default Order' },
              { id: 'SUCCESS_RATE_DESC', label: 'Highest Success Rate' },
              { id: 'SUCCESS_RATE_ASC', label: 'Lowest Success Rate' },
              { id: 'LATENCY_ASC', label: 'Lowest Latency (Fastest)' },
              { id: 'NAME_ASC', label: 'Alphabetical (A-Z)' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedSort(item.id as SortOption);
                  setShowSortModal(false);
                }}
                className={`w-full p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${
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
        </div>
      )}
    </div>
  );
};

export default App;
