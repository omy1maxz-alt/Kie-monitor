package com.example.kiestatusmonitor.data

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class KieMonitorResponse(
    @Json(name = "code") val code: Int? = null,
    @Json(name = "msg") val msg: String? = null,
    @Json(name = "message") val message: String? = null,
    @Json(name = "rate") val rate: Double? = null,
    @Json(name = "successRate") val successRate: Double? = null,
    @Json(name = "data") val data: KieMonitorData? = null
)

@JsonClass(generateAdapter = true)
data class KieMonitorData(
    @Json(name = "rate") val rate: Double? = null,
    @Json(name = "successRate") val successRate: Double? = null,
    @Json(name = "status") val status: String? = null,
    @Json(name = "latency") val latency: Long? = null
)

enum class HealthStatus {
    OPERATIONAL,
    DEGRADED,
    OUTAGE,
    CHECKING,
    UNTESTED
}

data class ModelHealth(
    val modelId: String,
    val modelName: String,
    val provider: String,
    val successRate: Double,
    val status: HealthStatus,
    val latencyMs: Long,
    val lastUpdated: String,
    val errorMessage: String? = null,
    val historyPoints: List<Double> = emptyList(),
    val isCustom: Boolean = false
)

data class SystemStatusSummary(
    val totalModels: Int = 0,
    val operationalCount: Int = 0,
    val degradedCount: Int = 0,
    val outageCount: Int = 0,
    val averageSuccessRate: Double = 0.0,
    val averageLatencyMs: Long = 0,
    val lastRefreshTime: String = "",
    val activeCookieCount: Int = 0
)

enum class ModelFilter {
    ALL,
    GOOGLE,
    OPENAI,
    ANTHROPIC,
    DEEPSEEK,
    ISSUES_ONLY
}

enum class SortOption {
    DEFAULT,
    SUCCESS_RATE_ASC,
    SUCCESS_RATE_DESC,
    LATENCY_ASC,
    NAME_ASC
}
