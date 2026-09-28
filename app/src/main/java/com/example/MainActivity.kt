package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.example.kiestatusmonitor.ui.KieMonitorScreen
import com.example.ui.theme.BgDarkest
import com.example.ui.theme.KieStatusMonitorTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            CompositionLocalProvider(LocalLifecycleOwner provides this) {
                KieStatusMonitorTheme {
                    Surface(
                        modifier = Modifier.fillMaxSize(),
                        color = BgDarkest
                    ) {
                        KieMonitorScreen()
                    }
                }
            }
        }
    }
}
