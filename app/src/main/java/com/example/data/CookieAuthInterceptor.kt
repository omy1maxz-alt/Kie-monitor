package com.example.data

import okhttp3.Interceptor
import okhttp3.Response

class CookieAuthInterceptor : Interceptor {

    @Volatile
    private var cookieString: String = ""

    @Volatile
    private var parsedCookieCount: Int = 0

    @Volatile
    private var authHeaderValue: String? = null

    @Volatile
    private var apidogKey: String? = null

    fun getParsedCookieCount(): Int = parsedCookieCount

    fun getRawCookieString(): String = cookieString

    fun setCookieFromRawText(rawText: String): Int {
        val pairs = mutableListOf<String>()
        val distinctKeys = mutableSetOf<String>()
        var foundAuth: String? = null
        var foundApidog: String? = null

        rawText.lines().forEach { line ->
            val trimmed = line.trim()
            if (trimmed.isNotEmpty() && !trimmed.startsWith("#")) {
                val parts = trimmed.split("\t")
                if (parts.size >= 7) {
                    // Netscape format: domain, flag, path, secure, expiration, name, value
                    val name = parts[5].trim()
                    val value = parts[6].trim()
                    if (name.isNotEmpty()) {
                        pairs.add("$name=$value")
                        distinctKeys.add(name)
                        if (name.equals("authorization", ignoreCase = true) || name.equals("auth", ignoreCase = true) || name.equals("token", ignoreCase = true)) {
                            foundAuth = value
                        }
                        if (name.equals("apidog-auth-key", ignoreCase = true) || name.equals("apidog_auth_key", ignoreCase = true)) {
                            foundApidog = value
                        }
                    }
                } else if (trimmed.contains("=")) {
                    // Standard header format: key=value; key2=val2
                    val subTokens = trimmed.split(";")
                    for (token in subTokens) {
                        val subTrimmed = token.trim()
                        if (subTrimmed.isNotEmpty() && subTrimmed.contains("=")) {
                            val key = subTrimmed.substringBefore("=").trim()
                            val value = subTrimmed.substringAfter("=").trim()
                            if (key.isNotEmpty()) {
                                pairs.add("$key=$value")
                                distinctKeys.add(key)
                                if (key.equals("authorization", ignoreCase = true) || key.equals("auth", ignoreCase = true) || key.equals("token", ignoreCase = true)) {
                                    foundAuth = value
                                }
                                if (key.equals("apidog-auth-key", ignoreCase = true) || key.equals("apidog_auth_key", ignoreCase = true)) {
                                    foundApidog = value
                                }
                            }
                        }
                    }
                }
            }
        }

        this.cookieString = pairs.joinToString("; ")
        this.parsedCookieCount = distinctKeys.size
        this.authHeaderValue = foundAuth
        this.apidogKey = foundApidog
        return parsedCookieCount
    }

    fun clearCookies() {
        this.cookieString = ""
        this.parsedCookieCount = 0
        this.authHeaderValue = null
        this.apidogKey = null
    }

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val builder = original.newBuilder()
            .header("Accept", "application/json")
            .header("User-Agent", "Mozilla/5.0 (Linux; Android 14; Mobile; KIE-Monitor/1.0)")

        val currentCookie = cookieString
        if (currentCookie.isNotEmpty()) {
            builder.header("Cookie", currentCookie)
        }

        authHeaderValue?.let { auth ->
            if (auth.isNotEmpty()) {
                val rawAuth = auth.replace("Bearer ", "", ignoreCase = true).trim()
                builder.header("Authorization", rawAuth)
            }
        }

        apidogKey?.let { key ->
            if (key.isNotEmpty()) {
                builder.header("apidog-auth-key", key)
            }
        }

        return chain.proceed(builder.build())
    }
}
