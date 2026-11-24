package app.oursafe.safety.shield

import android.Manifest
import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.PixelFormat
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.telephony.SmsManager
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import java.util.Locale
import kotlin.math.sqrt

/**
 * OurSafeBackgroundShieldService
 *
 * Runs as an Android Foreground Service with PARTIAL_WAKE_LOCK so OurSafe stays armed on:
 * 1. The phone's REAL Main Lock Screen (even with screen locked / dimmed)
 * 2. The phone's REAL Home Screen & over any other app (via TYPE_APPLICATION_OVERLAY)
 *
 * Handles:
 * - 3x Phone Shake via Hardware Accelerometer (SensorManager)
 * - Always-On Secret Voice Code via SpeechRecognizer
 * - Rapid Double/Triple Tap on the floating Lock/Home Shield Overlay (paired with OurSafeTapAccessibilityService)
 * - Direct Automatic Emergency Call (Intent.ACTION_CALL) + Live GPS SMS (SmsManager)
 */
class OurSafeBackgroundShieldService : Service(), SensorEventListener {

    companion object {
        const val CHANNEL_ID = "oursafe_lock_home_shield_channel"
        const val NOTIFICATION_ID = 4091
        const val ACTION_START = "app.oursafe.safety.ACTION_START_SHIELD"
        const val ACTION_STOP = "app.oursafe.safety.ACTION_STOP_SHIELD"
        const val ACTION_TRIGGER_SOS = "app.oursafe.safety.ACTION_TRIGGER_SOS"
        const val PREFS_NAME = "oursafe_native_shield_prefs"

        @Volatile
        var isRunning: Boolean = false
            private set

        fun dispatchSosIntent(context: Context, kind: String, label: String, detail: String, surface: String) {
            val intent = Intent(context, OurSafeBackgroundShieldService::class.java).apply {
                action = ACTION_TRIGGER_SOS
                putExtra("kind", kind)
                putExtra("label", label)
                putExtra("detail", detail)
                putExtra("surface", surface)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }

    private lateinit var sensorManager: SensorManager
    private var accelerometer: Sensor? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var speechRecognizer: SpeechRecognizer? = null
    private var textToSpeech: TextToSpeech? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    // Shake tracking
    private val shakeTimestamps = ArrayDeque<Long>()
    private var lastShakeAt = 0L
    private var lastX = 0f
    private var lastY = 0f
    private var lastZ = 0f
    private var hasLastAccel = false
    private var lastSosTriggeredAt = 0L

    // Overlay tap tracking
    private val overlayTapTimes = ArrayDeque<Long>()

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        textToSpeech = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                textToSpeech?.language = Locale("en", "IN")
            }
        }
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopShieldInternal()
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_TRIGGER_SOS -> {
                val kind = intent.getStringExtra("kind") ?: "screen_tap"
                val label = intent.getStringExtra("label") ?: "Lock/Home Screen SOS"
                val detail = intent.getStringExtra("detail") ?: "Emergency SOS triggered outside the app."
                val surface = intent.getStringExtra("surface") ?: currentSurfaceName()
                executeNativeEmergencyDispatch(kind, label, detail, surface)
                return START_STICKY
            }
            else -> {
                startForeground(NOTIFICATION_ID, buildPersistentNotification())
                isRunning = true
                acquireCpuWakeLock()
                armShakeSensor()
                armSecretVoiceCodeListener()
                attachLockAndHomeOverlayShield()
                return START_STICKY
            }
        }
    }

    override fun onDestroy() {
        stopShieldInternal()
        super.onDestroy()
    }

    private fun stopShieldInternal() {
        isRunning = false
        try {
            sensorManager.unregisterListener(this)
        } catch (_: Exception) {}
        stopSecretVoiceCodeListener()
        removeOverlayShield()
        try {
            textToSpeech?.stop()
            textToSpeech?.shutdown()
        } catch (_: Exception) {}
        textToSpeech = null
        try {
            wakeLock?.let { if (it.isHeld) it.release() }
        } catch (_: Exception) {}
        wakeLock = null
    }

    private fun acquireCpuWakeLock() {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        if (wakeLock == null) {
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "OurSafe::LockAndHomeShieldWakeLock"
            )
        }
        if (wakeLock?.isHeld == false) {
            wakeLock?.acquire(12 * 60 * 60 * 1000L) // 12h safety window
        }
    }

    private fun armShakeSensor() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val shakeEnabled = prefs.getBoolean("shakeEnabled", true)
        sensorManager.unregisterListener(this)
        if (shakeEnabled && accelerometer != null) {
            sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_UI)
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type != Sensor.TYPE_ACCELEROMETER) return
        val x = event.values[0]
        val y = event.values[1]
        val z = event.values[2]
        if (!hasLastAccel) {
            lastX = x; lastY = y; lastZ = z; hasLastAccel = true
            return
        }
        val dx = x - lastX
        val dy = y - lastY
        val dz = z - lastZ
        lastX = x; lastY = y; lastZ = z

        val delta = sqrt((dx * dx + dy * dy + dz * dz).toDouble())
        val now = System.currentTimeMillis()
        if (delta > 15.5 && now - lastShakeAt > 280L) {
            lastShakeAt = now
            while (shakeTimestamps.isNotEmpty() && now - shakeTimestamps.first() > 2600L) {
                shakeTimestamps.removeFirst()
            }
            shakeTimestamps.addLast(now)
            if (shakeTimestamps.size >= 3) {
                shakeTimestamps.clear()
                executeNativeEmergencyDispatch(
                    kind = "shake",
                    label = "3x Phone Shake SOS",
                    detail = "Detected 3 shakes on ${currentSurfaceName().replace('_', ' ')}.",
                    surface = currentSurfaceName()
                )
            }
        }
    }

    private fun armSecretVoiceCodeListener() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val voiceEnabled = prefs.getBoolean("voiceCodeEnabled", true)
        val wakeEnabled = prefs.getBoolean("wakeWordEnabled", true)
        if (!voiceEnabled && !wakeEnabled) {
            stopSecretVoiceCodeListener()
            return
        }
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            return
        }
        mainHandler.post { startSpeechLoop() }
    }

    private fun startSpeechLoop() {
        if (!isRunning || !SpeechRecognizer.isRecognitionAvailable(this)) return
        stopSecretVoiceCodeListener()

        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val secretCode = (prefs.getString("secretVoiceCode", "Red Rose") ?: "Red Rose")
            .lowercase(Locale.ROOT).trim()
        val lang = prefs.getString("voiceLanguage", "en-IN") ?: "en-IN"

        val recognizer = SpeechRecognizer.createSpeechRecognizer(this)
        speechRecognizer = recognizer

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        }

        recognizer.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) = Unit
            override fun onBeginningOfSpeech() = Unit
            override fun onRmsChanged(rmsdB: Float) = Unit
            override fun onBufferReceived(buffer: ByteArray?) = Unit
            override fun onEndOfSpeech() = Unit
            override fun onEvent(eventType: Int, params: Bundle?) = Unit

            override fun onError(error: Int) {
                if (isRunning) {
                    mainHandler.postDelayed({ startSpeechLoop() }, 600L)
                }
            }

            override fun onPartialResults(partialResults: Bundle?) {
                checkSpeechMatches(partialResults, secretCode)
            }

            override fun onResults(results: Bundle?) {
                checkSpeechMatches(results, secretCode)
                if (isRunning) {
                    mainHandler.postDelayed({ startSpeechLoop() }, 350L)
                }
            }
        })

        try {
            recognizer.startListening(intent)
        } catch (_: Exception) {
            mainHandler.postDelayed({ startSpeechLoop() }, 1200L)
        }
    }

    private fun checkSpeechMatches(bundle: Bundle?, secretCode: String) {
        val matches = bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: return
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val voiceCodeEnabled = prefs.getBoolean("voiceCodeEnabled", true)
        val wakeWordEnabled = prefs.getBoolean("wakeWordEnabled", true)
        val wakeWord = (prefs.getString("wakeWordPhrase", "OurSafe") ?: "OurSafe")
            .lowercase(Locale.ROOT).trim()
        val compactCode = secretCode.replace(" ", "")
        val compactWake = wakeWord.replace(" ", "")

        for (spoken in matches) {
            val normalized = spoken.lowercase(Locale.ROOT).trim()
            val compactSpoken = normalized.replace(" ", "")

            if (voiceCodeEnabled && (normalized.contains(secretCode) || compactSpoken.contains(compactCode))) {
                executeNativeEmergencyDispatch(
                    kind = "voice_code",
                    label = "Secret Voice Code (\"$secretCode\")",
                    detail = "Heard secret phrase \"$spoken\" on ${currentSurfaceName().replace('_', ' ')}.",
                    surface = currentSurfaceName()
                )
                break
            }

            if (wakeWordEnabled && (
                normalized.contains(wakeWord) ||
                normalized.contains("our safe") ||
                normalized.contains("house safe") ||
                normalized.contains("hour safe") ||
                normalized.contains("ஹவுஸ் சேஃப்") ||
                normalized.contains("அவர் சேஃப்") ||
                compactSpoken.contains(compactWake) ||
                compactSpoken.contains("oursafe") ||
                compactSpoken.contains("housesafe")
            )) {
                launchOurSafeVoiceAssistant(spoken)
                break
            }
        }
    }

    private fun launchOurSafeVoiceAssistant(spoken: String) {
        try {
            textToSpeech?.speak(
                "OurSafe app is here, how can I help you?",
                TextToSpeech.QUEUE_FLUSH,
                null,
                "oursafe_wake_greeting"
            )
        } catch (_: Exception) {}

        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("oursafe_voice_wake", true)
            putExtra("oursafe_spoken_command", spoken)
        }
        if (launchIntent != null) {
            try {
                startActivity(launchIntent)
            } catch (_: Exception) {}
        }
    }

    private fun stopSecretVoiceCodeListener() {
        mainHandler.post {
            try {
                speechRecognizer?.destroy()
            } catch (_: Exception) {}
            speechRecognizer = null
        }
    }

    /**
     * Attaches a minimal, unobtrusive floating SOS icon (or compact SOS + OurSafe badge)
     * on the phone's Lock Screen & Home Screen — NEVER captures the whole screen.
     */
    private fun attachLockAndHomeOverlayShield() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            return
        }
        mainHandler.post {
            removeOverlayShield()
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val requiredTaps = prefs.getInt("screenTapCount", 3)
            val displayStyle = prefs.getString("lockScreenDisplayStyle", "icon_and_name") ?: "icon_and_name"

            val badgeBg = android.graphics.drawable.GradientDrawable().apply {
                setColor(Color.parseColor("#E6DC2626"))
                cornerRadius = 999f
                setStroke(3, Color.parseColor("#FFFFFF"))
            }

            val container = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(if (displayStyle == "icon_only") 24 else 26, 16, if (displayStyle == "icon_only") 24 else 26, 16)
                background = badgeBg
            }

            val label = TextView(this).apply {
                text = if (displayStyle == "icon_only") "SOS" else "SOS · OurSafe"
                setTextColor(Color.WHITE)
                textSize = 12f
            }
            container.addView(label)

            container.setOnTouchListener { _, event ->
                if (event.action == MotionEvent.ACTION_DOWN) {
                    val now = System.currentTimeMillis()
                    while (overlayTapTimes.isNotEmpty() && now - overlayTapTimes.first() > 800L) {
                        overlayTapTimes.removeFirst()
                    }
                    overlayTapTimes.addLast(now)
                    if (overlayTapTimes.size >= requiredTaps) {
                        overlayTapTimes.clear()
                        executeNativeEmergencyDispatch(
                            kind = "screen_tap",
                            label = if (requiredTaps == 2) "Double-Tap Shield SOS" else "Triple-Tap Shield SOS",
                            detail = "Tapped minimal OurSafe SOS icon ${requiredTaps}x on ${currentSurfaceName().replace('_', ' ')}.",
                            surface = currentSurfaceName()
                        )
                    }
                    true
                } else {
                    false
                }
            }

            val overlayType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            }

            @Suppress("DEPRECATION")
            val params = WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                overlayType,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.BOTTOM or Gravity.END
                x = 28
                y = 140
            }

            try {
                windowManager?.addView(container, params)
                overlayView = container
            } catch (_: Exception) {}
        }
    }

    private fun removeOverlayShield() {
        mainHandler.post {
            overlayView?.let {
                try {
                    windowManager?.removeView(it)
                } catch (_: Exception) {}
            }
            overlayView = null
        }
    }

    private fun executeNativeEmergencyDispatch(
        kind: String,
        label: String,
        detail: String,
        surface: String
    ) {
        val now = System.currentTimeMillis()
        if (now - lastSosTriggeredAt < 4000L) return
        lastSosTriggeredAt = now

        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val userName = prefs.getString("userName", "OurSafe User") ?: "OurSafe User"
        val guardianPhone = prefs.getString("guardianPhone", "") ?: ""
        val policePhone = prefs.getString("policePhone", "100") ?: "100"
        val autoDial = prefs.getBoolean("autoDialEnabled", true)

        // 1. Broadcast event to Capacitor plugin / React UI
        OurSafeShieldPlugin.emitNativeTrigger(kind, label, detail, surface)

        // 2. Send Live GPS SMS to Guardian if SEND_SMS granted
        if (guardianPhone.isNotBlank() &&
            ActivityCompat.checkSelfPermission(this, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED
        ) {
            val coords = getLastKnownCoordsString()
            val message = "EMERGENCY SOS from $userName via OurSafe ($label)! $coords"
            try {
                val smsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    getSystemService(SmsManager::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    SmsManager.getDefault()
                }
                smsManager.sendTextMessage(guardianPhone, null, message, null, null)
            } catch (_: Exception) {}
        }

        // 3. Place direct Emergency Call automatically (works over Lock Screen & Home Screen)
        if (autoDial) {
            val dialTarget = if (guardianPhone.isNotBlank()) guardianPhone else policePhone
            val canCallDirect = ActivityCompat.checkSelfPermission(
                this,
                Manifest.permission.CALL_PHONE
            ) == PackageManager.PERMISSION_GRANTED
            val callIntent = Intent(
                if (canCallDirect) Intent.ACTION_CALL else Intent.ACTION_DIAL,
                Uri.parse("tel:$dialTarget")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            try {
                startActivity(callIntent)
            } catch (_: Exception) {}
        }
    }

    private fun getLastKnownCoordsString(): String {
        val hasFine = ActivityCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        if (!hasFine) return "GPS unavailable."
        val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val loc: Location? = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)
            ?: lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
        return if (loc != null) {
            "Live GPS: https://maps.google.com/?q=${loc.latitude},${loc.longitude}"
        } else {
            "GPS locating."
        }
    }

    private fun currentSurfaceName(): String {
        val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        return if (km.isKeyguardLocked) "lock_screen" else "home_screen"
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "OurSafe Lock & Home Screen Shield",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps 3x Shake, Secret Voice Code, and Screen Tap SOS active on Lock Screen and Home Screen."
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)
        }
    }

    private fun buildPersistentNotification(): Notification {
        val sosIntent = Intent(this, OurSafeBackgroundShieldService::class.java).apply {
            action = ACTION_TRIGGER_SOS
            putExtra("kind", "screen_tap")
            putExtra("label", "Lock-Screen Notification SOS")
            putExtra("detail", "Triggered directly from Android Lock-Screen notification.")
        }
        val sosPendingIntent = PendingIntent.getService(
            this,
            101,
            sosIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("OurSafe Lock & Home Shield Armed")
            .setContentText("3x Shake, Secret Voice Code & Screen Tap SOS active on Lock Screen & Home Screen")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setOngoing(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(android.R.drawable.ic_menu_call, "CALL SOS NOW", sosPendingIntent)
            .build()
    }
}
