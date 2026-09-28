package com.example.data

import org.json.JSONArray
import org.json.JSONObject

enum class HealthStatus {
    OPERATIONAL,
    DEGRADED,
    OUTAGE
}

data class ParsedMonitorResult(
    val successRate: Double,
    val isSuccess: Boolean,
    val history: List<Double> = emptyList(),
    val rawMessage: String? = null
)

object KieJsonParser {
    fun parseSuccessRateResponse(jsonString: String): ParsedMonitorResult {
        try {
            val trimmed = jsonString.trim()
            if (trimmed.startsWith("[")) {
                val array = JSONArray(trimmed)
                val history = mutableListOf<Double>()
                var latestRate = 98.0
                for (i in 0 until array.length()) {
                    val item = array.opt(i)
                    val r = extractRateFromObjectOrPrimitive(item)
                    if (r != null) {
                        history.add(r)
                        latestRate = r
                    }
                }
                return ParsedMonitorResult(
                    successRate = normalizeRate(latestRate),
                    isSuccess = true,
                    history = history
                )
            }

            val json = JSONObject(trimmed)
            val code = json.optInt("code", json.optInt("status", 200))
            val msg = json.optString("msg", json.optString("message", ""))

            var rate: Double? = null
            val history = mutableListOf<Double>()

            // 1. Direct top-level fields (response.rate)
            if (json.has("rate") && !json.isNull("rate")) rate = json.optDouble("rate")
            else if (json.has("successRate") && !json.isNull("successRate")) rate = json.optDouble("successRate")
            else if (json.has("success_rate") && !json.isNull("success_rate")) rate = json.optDouble("success_rate")

            // 2. Data field check (response.data.rate, response.data.successRate, or array)
            if (json.has("data") && !json.isNull("data")) {
                val dataArray = json.optJSONArray("data")
                val dataObj = json.optJSONObject("data")

                if (dataArray != null) {
                    for (i in 0 until dataArray.length()) {
                        val item = dataArray.opt(i)
                        val r = extractRateFromObjectOrPrimitive(item)
                        if (r != null) {
                            history.add(r)
                            rate = r
                        }
                    }
                } else if (dataObj != null) {
                    if (rate == null) {
                        if (dataObj.has("rate") && !dataObj.isNull("rate")) rate = dataObj.optDouble("rate")
                        else if (dataObj.has("successRate") && !dataObj.isNull("successRate")) rate = dataObj.optDouble("successRate")
                        else if (dataObj.has("success_rate") && !dataObj.isNull("success_rate")) rate = dataObj.optDouble("success_rate")
                        else if (dataObj.has("value") && !dataObj.isNull("value")) rate = dataObj.optDouble("value")
                    }
                } else {
                    val num = json.optDouble("data", Double.NaN)
                    if (!num.isNaN()) {
                        rate = num
                    }
                }
            }

            val finalRate = normalizeRate(rate ?: if (code == 200 || code == 0) 100.0 else 98.0)

            return ParsedMonitorResult(
                successRate = finalRate,
                isSuccess = code == 200 || code == 0,
                history = history,
                rawMessage = if (msg.isNotBlank()) msg else null
            )
        } catch (e: Exception) {
            return ParsedMonitorResult(
                successRate = 98.0,
                isSuccess = true,
                rawMessage = e.message
            )
        }
    }

    private fun extractRateFromObjectOrPrimitive(item: Any?): Double? {
        if (item == null) return null
        if (item is Number) return item.toDouble()
        if (item is JSONObject) {
            if (item.has("rate") && !item.isNull("rate")) return item.optDouble("rate")
            if (item.has("successRate") && !item.isNull("successRate")) return item.optDouble("successRate")
            if (item.has("success_rate") && !item.isNull("success_rate")) return item.optDouble("success_rate")
            if (item.has("value") && !item.isNull("value")) return item.optDouble("value")
            if (item.has("ratio") && !item.isNull("ratio")) return item.optDouble("ratio")
        }
        return null
    }

    fun normalizeRate(rate: Double): Double {
        var r = rate
        if (r in 0.0001..1.0) {
            r *= 100.0
        }
        return r.coerceIn(0.0, 100.0)
    }
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
