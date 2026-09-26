package com.example.kiestatusmonitor.data

import okhttp3.Interceptor
import okhttp3.Response

class CookieAuthInterceptor(private var cookieString: String = "") : Interceptor {

    private var parsedCookieCount: Int = 0

    fun getParsedCookieCount(): Int = parsedCookieCount

    fun getRawCookieString(): String = cookieString

    fun setCookieFromRawText(rawText: String): Int {
        val pairs = mutableListOf<String>()
        val distinctKeys = mutableSetOf<String>()

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
                    }
                } else if (trimmed.contains("=")) {
                    // Standard header format: key=value; key2=val2
                    val subTokens = trimmed.split(";")
                    for (token in subTokens) {
                        val subTrimmed = token.trim()
                        if (subTrimmed.isNotEmpty() && subTrimmed.contains("=")) {
                            val key = subTrimmed.substringBefore("=").trim()
                            if (key.isNotEmpty()) {
                                pairs.add(subTrimmed)
                                distinctKeys.add(key)
                            }
                        }
                    }
                }
            }
        }

        this.cookieString = pairs.joinToString("; ")
        this.parsedCookieCount = distinctKeys.size
        return parsedCookieCount
    }

    fun clearCookies() {
        this.cookieString = ""
        this.parsedCookieCount = 0
    }

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val builder = original.newBuilder()
            .header("Accept", "application/json")
            .header("User-Agent", "Mozilla/5.0 (Android; Mobile; KIE-Monitor/1.0)")

        if (cookieString.isNotEmpty()) {
            builder.header("Cookie", cookieString)
        }

        return chain.proceed(builder.build())
    }
}
