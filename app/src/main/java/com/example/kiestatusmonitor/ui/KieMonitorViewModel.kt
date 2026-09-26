package com.example.kiestatusmonitor.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.kiestatusmonitor.data.CookieStorage
import com.example.kiestatusmonitor.data.HealthStatus
import com.example.kiestatusmonitor.data.KieApiService
import com.example.kiestatusmonitor.data.ModelFilter
import com.example.kiestatusmonitor.data.ModelHealth
import com.example.kiestatusmonitor.data.NetworkClient
import com.example.kiestatusmonitor.data.SortOption
import com.example.kiestatusmonitor.data.SystemStatusSummary
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class KieMonitorViewModel(application: Application) : AndroidViewModel(application) {

    private val cookieStorage = CookieStorage(application)

    private val defaultModels = listOf(
        "gemini-3.5-flash",
        "gemini-3.7-flash",
        "gemini-3.8-flash",
        "gpt-5-6-sol",
        "gpt-5-6-luna",
        "gpt-5-5",
        "gpt-5-2",
        "claude-sonnet-5",
        "claude-opus-5",
        "deepseek-v4-1-flash",
        "deepseek-r1"
    )

    private val _customModels = MutableStateFlow<List<String>>(emptyList())
    val customModels: StateFlow<List<String>> = _customModels.asStateFlow()

    private val _modelsState = MutableStateFlow<List<ModelHealth>>(emptyList())
    val modelsState: StateFlow<List<ModelHealth>> = _modelsState.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _selectedFilter = MutableStateFlow(ModelFilter.ALL)
    val selectedFilter: StateFlow<ModelFilter> = _selectedFilter.asStateFlow()

    private val _selectedSort = MutableStateFlow(SortOption.DEFAULT)
    val selectedSort: StateFlow<SortOption> = _selectedSort.asStateFlow()

    private val _savedCookieText = MutableStateFlow("")
    val savedCookieText: StateFlow<String> = _savedCookieText.asStateFlow()

    private val _cookieCount = MutableStateFlow(0)
    val cookieCount: StateFlow<Int> = _cookieCount.asStateFlow()

    private val _autoRefreshSeconds = MutableStateFlow(45)
    val autoRefreshSeconds: StateFlow<Int> = _autoRefreshSeconds.asStateFlow()

    private val _isAutoRefreshEnabled = MutableStateFlow(true)
    val isAutoRefreshEnabled: StateFlow<Boolean> = _isAutoRefreshEnabled.asStateFlow()

    private val _selectedModelForDetails = MutableStateFlow<ModelHealth?>(null)
    val selectedModelForDetails: StateFlow<ModelHealth?> = _selectedModelForDetails.asStateFlow()

    private val _lastRefreshTimestamp = MutableStateFlow("")
    val lastRefreshTimestamp: StateFlow<String> = _lastRefreshTimestamp.asStateFlow()

    // History points map to track last 10 readings per model for uptime trends
    private val modelHistoryMap = mutableMapOf<String, MutableList<Double>>()

    private var autoRefreshJob: Job? = null

    init {
        // Load saved custom models
        val savedCustom = cookieStorage.getCustomModels()
        _customModels.value = savedCustom

        // Load saved cookie
        val savedCookie = cookieStorage.getSavedCookie()
        if (savedCookie.isNotBlank()) {
            _savedCookieText.value = savedCookie
            val count = NetworkClient.cookieInterceptor.setCookieFromRawText(savedCookie)
            _cookieCount.value = count
        }

        val savedInterval = cookieStorage.getRefreshInterval()
        _autoRefreshSeconds.value = savedInterval

        // Initialize empty model states
        initInitialModelList()

        // Start auto-refresh loop
        startAutoRefreshLoop()
    }

    private fun getAllCurrentModelIds(): List<String> {
        val list = mutableListOf<String>()
        list.addAll(defaultModels)
        list.addAll(_customModels.value)
        return list.distinct()
    }

    private fun initInitialModelList() {
        val allIds = getAllCurrentModelIds()
        val initialList = allIds.map { id ->
            ModelHealth(
                modelId = id,
                modelName = formatModelName(id),
                provider = determineProvider(id),
                successRate = 0.0,
                status = HealthStatus.UNTESTED,
                latencyMs = 0,
                lastUpdated = "Pending check...",
                isCustom = !defaultModels.contains(id)
            )
        }
        _modelsState.value = initialList
    }

    private fun formatModelName(modelId: String): String {
        return modelId.split("-", "_").joinToString(" ") { word ->
            if (word.lowercase(Locale.ROOT) in listOf("gpt", "api", "ai", "r1", "sol", "luna")) {
                word.uppercase(Locale.ROOT)
            } else {
                word.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.ROOT) else it.toString() }
            }
        }
    }

    private fun determineProvider(modelId: String): String {
        val lower = modelId.lowercase(Locale.ROOT)
        return when {
            lower.contains("gemini") || lower.contains("google") -> "Google"
            lower.contains("gpt") || lower.contains("openai") || lower.contains("o1") || lower.contains("o3") -> "OpenAI"
            lower.contains("claude") || lower.contains("anthropic") -> "Anthropic"
            lower.contains("deepseek") -> "DeepSeek"
            lower.contains("mistral") || lower.contains("mixtral") -> "Mistral"
            lower.contains("meta") || lower.contains("llama") -> "Meta"
            else -> "KIE Gateway"
        }
    }

    fun startAutoRefreshLoop() {
        autoRefreshJob?.cancel()
        if (!_isAutoRefreshEnabled.value) return

        autoRefreshJob = viewModelScope.launch {
            while (isActive && _isAutoRefreshEnabled.value) {
                refreshStatus()
                val interval = _autoRefreshSeconds.value.coerceAtLeast(10)
                delay(interval * 1000L)
            }
        }
    }

    fun toggleAutoRefresh(enabled: Boolean) {
        _isAutoRefreshEnabled.value = enabled
        if (enabled) {
            startAutoRefreshLoop()
        } else {
            autoRefreshJob?.cancel()
        }
    }

    fun setAutoRefreshInterval(seconds: Int) {
        _autoRefreshSeconds.value = seconds
        cookieStorage.saveRefreshInterval(seconds)
        if (_isAutoRefreshEnabled.value) {
            startAutoRefreshLoop()
        }
    }

    fun setCookieText(rawCookie: String) {
        _savedCookieText.value = rawCookie
        cookieStorage.saveCookie(rawCookie)
        val count = NetworkClient.cookieInterceptor.setCookieFromRawText(rawCookie)
        _cookieCount.value = count
        refreshStatus()
    }

    fun clearCookie() {
        _savedCookieText.value = ""
        cookieStorage.clearSavedCookie()
        NetworkClient.cookieInterceptor.clearCookies()
        _cookieCount.value = 0
        refreshStatus()
    }

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun setFilter(filter: ModelFilter) {
        _selectedFilter.value = filter
    }

    fun setSort(sort: SortOption) {
        _selectedSort.value = sort
    }

    fun selectModelForDetails(model: ModelHealth?) {
        _selectedModelForDetails.value = model
    }

    fun addCustomModel(modelId: String): Boolean {
        val trimmed = modelId.trim().lowercase(Locale.ROOT)
        if (trimmed.isBlank()) return false
        val current = _customModels.value.toMutableList()
        if (!current.contains(trimmed) && !defaultModels.contains(trimmed)) {
            current.add(trimmed)
            _customModels.value = current
            cookieStorage.saveCustomModels(current)
            initInitialModelList()
            refreshSingleModel(trimmed)
            return true
        }
        return false
    }

    fun removeCustomModel(modelId: String) {
        val current = _customModels.value.toMutableList()
        if (current.remove(modelId)) {
            _customModels.value = current
            cookieStorage.saveCustomModels(current)
            modelHistoryMap.remove(modelId)
            _modelsState.value = _modelsState.value.filter { it.modelId != modelId }
        }
    }

    fun refreshSingleModel(modelId: String) {
        viewModelScope.launch(Dispatchers.IO) {
            val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
            val timestamp = timeFormat.format(Date())

            val start = System.currentTimeMillis()
            var errorMsg: String? = null
            var rate = 0.0
            var latency = 0L

            try {
                val resp = NetworkClient.api.getSuccessRate(modelId)
                latency = System.currentTimeMillis() - start

                rate = resp.rate
                    ?: resp.successRate
                    ?: resp.data?.rate
                    ?: resp.data?.successRate
                    ?: if (resp.code == 200 || resp.code == 0) 100.0 else 98.0

                if (rate in 0.001..1.0) {
                    rate *= 100.0
                }
            } catch (e: Exception) {
                latency = System.currentTimeMillis() - start
                errorMsg = e.localizedMessage ?: "Connection error"
                rate = 0.0
            }

            val status = when {
                errorMsg != null -> HealthStatus.OUTAGE
                rate >= 90.0 -> HealthStatus.OPERATIONAL
                rate >= 50.0 -> HealthStatus.DEGRADED
                else -> HealthStatus.OUTAGE
            }

            val history = modelHistoryMap.getOrPut(modelId) { mutableListOf() }
            history.add(rate)
            if (history.size > 12) history.removeAt(0)

            val updatedModel = ModelHealth(
                modelId = modelId,
                modelName = formatModelName(modelId),
                provider = determineProvider(modelId),
                successRate = rate,
                status = status,
                latencyMs = latency,
                lastUpdated = timestamp,
                errorMessage = errorMsg,
                historyPoints = history.toList(),
                isCustom = !defaultModels.contains(modelId)
            )

            _modelsState.value = _modelsState.value.map {
                if (it.modelId == modelId) updatedModel else it
            }

            if (_selectedModelForDetails.value?.modelId == modelId) {
                _selectedModelForDetails.value = updatedModel
            }
        }
    }

    fun refreshStatus() {
        viewModelScope.launch(Dispatchers.IO) {
            _isRefreshing.value = true
            val results = mutableListOf<ModelHealth>()
            val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
            val timestamp = timeFormat.format(Date())

            val allModels = getAllCurrentModelIds()

            for (model in allModels) {
                val start = System.currentTimeMillis()
                var errorMsg: String? = null
                var rate = 0.0
                var latency = 0L

                try {
                    val resp = NetworkClient.api.getSuccessRate(model)
                    latency = System.currentTimeMillis() - start

                    rate = resp.rate
                        ?: resp.successRate
                        ?: resp.data?.rate
                        ?: resp.data?.successRate
                        ?: if (resp.code == 200 || resp.code == 0) 100.0 else 98.0

                    if (rate in 0.001..1.0) {
                        rate *= 100.0
                    }
                } catch (e: Exception) {
                    latency = (System.currentTimeMillis() - start).coerceAtLeast(1)
                    errorMsg = e.localizedMessage ?: "Failed to reach endpoint"
                    rate = 0.0
                }

                val status = when {
                    errorMsg != null -> HealthStatus.OUTAGE
                    rate >= 90.0 -> HealthStatus.OPERATIONAL
                    rate >= 50.0 -> HealthStatus.DEGRADED
                    else -> HealthStatus.OUTAGE
                }

                val history = modelHistoryMap.getOrPut(model) { mutableListOf() }
                history.add(rate)
                if (history.size > 12) history.removeAt(0)

                results.add(
                    ModelHealth(
                        modelId = model,
                        modelName = formatModelName(model),
                        provider = determineProvider(model),
                        successRate = rate,
                        status = status,
                        latencyMs = latency,
                        lastUpdated = timestamp,
                        errorMessage = errorMsg,
                        historyPoints = history.toList(),
                        isCustom = !defaultModels.contains(model)
                    )
                )
            }

            _modelsState.value = results
            _lastRefreshTimestamp.value = timestamp
            _isRefreshing.value = false

            // Update details sheet if open
            _selectedModelForDetails.value?.let { currentDetail ->
                results.find { it.modelId == currentDetail.modelId }?.let {
                    _selectedModelForDetails.value = it
                }
            }
        }
    }

    fun getSummary(): SystemStatusSummary {
        val list = _modelsState.value
        val total = list.size
        if (total == 0) return SystemStatusSummary()

        val operational = list.count { it.status == HealthStatus.OPERATIONAL }
        val degraded = list.count { it.status == HealthStatus.DEGRADED }
        val outage = list.count { it.status == HealthStatus.OUTAGE }

        val activeList = list.filter { it.status != HealthStatus.UNTESTED }
        val avgSuccess = if (activeList.isNotEmpty()) activeList.map { it.successRate }.average() else 0.0
        val avgLatency = if (activeList.isNotEmpty()) activeList.map { it.latencyMs }.average().toLong() else 0L

        return SystemStatusSummary(
            totalModels = total,
            operationalCount = operational,
            degradedCount = degraded,
            outageCount = outage,
            averageSuccessRate = avgSuccess,
            averageLatencyMs = avgLatency,
            lastRefreshTime = _lastRefreshTimestamp.value,
            activeCookieCount = _cookieCount.value
        )
    }

    fun generateStatusReport(): String {
        val summary = getSummary()
        val list = _modelsState.value
        val sb = StringBuilder()
        sb.append("=== KIE Status Monitor Report ===\n")
        sb.append("Timestamp: ${summary.lastRefreshTime.ifEmpty { "N/A" }}\n")
        sb.append("Total Models: ${summary.totalModels}\n")
        sb.append("Operational: ${summary.operationalCount} | Degraded: ${summary.degradedCount} | Outages: ${summary.outageCount}\n")
        sb.append("Avg Success Rate: ${String.format(Locale.US, "%.1f%%", summary.averageSuccessRate)}\n")
        sb.append("Avg Latency: ${summary.averageLatencyMs}ms\n\n")
        sb.append("Model Breakdown:\n")
        for (m in list) {
            sb.append("- ${m.modelName} (${m.modelId}) [${m.provider}]: ")
            sb.append("${String.format(Locale.US, "%.1f%%", m.successRate)} | ${m.status.name} | ${m.latencyMs}ms\n")
            if (m.errorMessage != null) {
                sb.append("  Error: ${m.errorMessage}\n")
            }
        }
        return sb.toString()
    }
}
