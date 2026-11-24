package app.oursafe.safety.shield

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.app.KeyguardManager
import android.content.Context
import android.view.accessibility.AccessibilityEvent

/**
 * OurSafeTapAccessibilityService
 *
 * Detects rapid Double-Tap (2x) or Triple-Tap (3x) interactions across the phone's
 * REAL Main Lock Screen and Phone Home Screen, even when the OurSafe app is closed.
 */
class OurSafeTapAccessibilityService : AccessibilityService() {

    private val tapTimestamps = ArrayDeque<Long>()

    override fun onServiceConnected() {
        super.onServiceConnected()
        serviceInfo = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_VIEW_CLICKED or
                AccessibilityEvent.TYPE_TOUCH_INTERACTION_START
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
            notificationTimeout = 50
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        if (event.eventType != AccessibilityEvent.TYPE_TOUCH_INTERACTION_START &&
            event.eventType != AccessibilityEvent.TYPE_VIEW_CLICKED
        ) {
            return
        }

        val prefs = getSharedPreferences(
            OurSafeBackgroundShieldService.PREFS_NAME,
            Context.MODE_PRIVATE
        )
        if (!prefs.getBoolean("screenTapEnabled", true)) return
        val requiredTaps = prefs.getInt("screenTapCount", 3)

        val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        val onLockScreen = km.isKeyguardLocked
        val pkg = event.packageName?.toString() ?: ""
        val onHomeLauncher = pkg.contains("launcher", ignoreCase = true) ||
            pkg.contains("home", ignoreCase = true) ||
            pkg.contains("systemui", ignoreCase = true)

        // Only count global taps on the Phone's Main Lock Screen or Phone's Home Screen
        if (!onLockScreen && !onHomeLauncher) return

        val now = System.currentTimeMillis()
        while (tapTimestamps.isNotEmpty() && now - tapTimestamps.first() > 750L) {
            tapTimestamps.removeFirst()
        }
        tapTimestamps.addLast(now)

        if (tapTimestamps.size >= requiredTaps) {
            tapTimestamps.clear()
            val surface = if (onLockScreen) "lock_screen" else "home_screen"
            OurSafeBackgroundShieldService.dispatchSosIntent(
                context = this,
                kind = "screen_tap",
                label = if (requiredTaps == 2) "Double-Tap SOS" else "Triple-Tap SOS",
                detail = "Detected ${requiredTaps}x rapid tap on Phone ${if (onLockScreen) "Main Lock Screen" else "Home Screen"}.",
                surface = surface
            )
        }
    }

    override fun onInterrupt() = Unit
}
