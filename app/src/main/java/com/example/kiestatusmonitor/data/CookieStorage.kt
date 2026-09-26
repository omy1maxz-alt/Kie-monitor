package com.example.kiestatusmonitor.data

import android.content.Context
import android.content.SharedPreferences

class CookieStorage(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("kie_monitor_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_SAVED_COOKIE = "saved_cookie_raw_text"
        private const val KEY_AUTO_REFRESH_INTERVAL = "auto_refresh_interval_sec"
        private const val KEY_CUSTOM_MODELS = "custom_models_csv"
    }

    fun saveCookie(rawText: String) {
        prefs.edit().putString(KEY_SAVED_COOKIE, rawText).apply()
    }

    fun getSavedCookie(): String {
        return prefs.getString(KEY_SAVED_COOKIE, "") ?: ""
    }

    fun clearSavedCookie() {
        prefs.edit().remove(KEY_SAVED_COOKIE).apply()
    }

    fun saveRefreshInterval(seconds: Int) {
        prefs.edit().putInt(KEY_AUTO_REFRESH_INTERVAL, seconds).apply()
    }

    fun getRefreshInterval(): Int {
        return prefs.getInt(KEY_AUTO_REFRESH_INTERVAL, 45)
    }

    fun saveCustomModels(models: List<String>) {
        prefs.edit().putString(KEY_CUSTOM_MODELS, models.joinToString(",")).apply()
    }

    fun getCustomModels(): List<String> {
        val raw = prefs.getString(KEY_CUSTOM_MODELS, "") ?: ""
        if (raw.isBlank()) return emptyList()
        return raw.split(",").map { it.trim() }.filter { it.isNotEmpty() }
    }
}
