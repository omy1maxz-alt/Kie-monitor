package com.example.data

import okhttp3.OkHttpClient
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit

object NetworkClient {
    val cookieInterceptor = CookieAuthInterceptor()

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(cookieInterceptor)
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    val api: KieApiService = Retrofit.Builder()
        .baseUrl("https://api.kie.ai/")
        .client(okHttpClient)
        .build()
        .create(KieApiService::class.java)
}
