package com.example.data

import okhttp3.ResponseBody
import retrofit2.http.GET
import retrofit2.http.Query

interface KieApiService {
    @GET("api/v1/monitor/success-rate")
    suspend fun getSuccessRate(@Query("model") modelId: String): ResponseBody
}
