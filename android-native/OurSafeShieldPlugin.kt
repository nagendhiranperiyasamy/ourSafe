package app.oursafe.safety.shield

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * OurSafeShieldPlugin
 *
 * Capacitor JS <-> Android bridge registered as "OurSafeShield".
 * Receives config syncs from src/utils/nativeShieldBridge.ts and controls
 * OurSafeBackgroundShieldService across the phone's Main Lock Screen & Home Screen.
 */
@CapacitorPlugin(name = "OurSafeShield")
class OurSafeShieldPlugin : Plugin() {

    companion object {
        private var instance: OurSafeShieldPlugin? = null

        fun emitNativeTrigger(kind: String, label: String, detail: String, surface: String) {
            val data = JSObject().apply {
                put("kind", kind)
                put("label", label)
                put("detail", detail)
                put("surface", surface)
            }
            instance?.notifyListeners("nativeSosTriggered", data)
        }
    }

    override fun load() {
        super.load()
        instance = this
    }

    @PluginMethod
    fun syncConfig(call: PluginCall) {
        saveConfigToPrefs(call)
        call.resolve(JSObject().put("ok", true))
    }

    @PluginMethod
    fun startLockAndHomeShield(call: PluginCall) {
        saveConfigToPrefs(call)
        val intent = Intent(context, OurSafeBackgroundShieldService::class.java).apply {
            action = OurSafeBackgroundShieldService.ACTION_START
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
        call.resolve(
            JSObject()
                .put("ok", true)
                .put("serviceRunning", true)
        )
    }

    @PluginMethod
    fun stopLockAndHomeShield(call: PluginCall) {
        val intent = Intent(context, OurSafeBackgroundShieldService::class.java).apply {
            action = OurSafeBackgroundShieldService.ACTION_STOP
        }
        context.startService(intent)
        call.resolve(JSObject().put("ok", true))
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val overlayGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
            Settings.canDrawOverlays(context)
        val callGranted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.CALL_PHONE
        ) == PackageManager.PERMISSION_GRANTED
        val micGranted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED

        val enabledServices = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: ""
        val accessibilityGranted = enabledServices.contains(OurSafeTapAccessibilityService::class.java.simpleName)

        call.resolve(
            JSObject()
                .put("isNativeAndroid", true)
                .put("serviceRunning", OurSafeBackgroundShieldService.isRunning)
                .put("overlayPermissionGranted", overlayGranted)
                .put("accessibilityPermissionGranted", accessibilityGranted)
                .put("callPermissionGranted", callGranted)
                .put("micPermissionGranted", micGranted)
        )
    }

    @PluginMethod
    fun requestOverlayPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${context.packageName}")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            call.resolve(JSObject().put("granted", false))
            return
        }
        call.resolve(JSObject().put("granted", true))
    }

    @PluginMethod
    fun openAccessibilitySettings(call: PluginCall) {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        call.resolve()
    }

    private fun saveConfigToPrefs(call: PluginCall) {
        val prefs = context.getSharedPreferences(
            OurSafeBackgroundShieldService.PREFS_NAME,
            Context.MODE_PRIVATE
        )
        prefs.edit()
            .putBoolean("shakeEnabled", call.getBoolean("shakeEnabled", true) ?: true)
            .putBoolean("voiceCodeEnabled", call.getBoolean("voiceCodeEnabled", true) ?: true)
            .putString("secretVoiceCode", call.getString("secretVoiceCode", "Red Rose"))
            .putString("voiceLanguage", call.getString("voiceLanguage", "en-IN"))
            .putBoolean("wakeWordEnabled", call.getBoolean("wakeWordEnabled", true) ?: true)
            .putString("wakeWordPhrase", call.getString("wakeWordPhrase", "OurSafe"))
            .putBoolean("screenTapEnabled", call.getBoolean("screenTapEnabled", true) ?: true)
            .putInt("screenTapCount", call.getInt("screenTapCount", 3) ?: 3)
            .putString("lockScreenDisplayStyle", call.getString("lockScreenDisplayStyle", "icon_and_name"))
            .putBoolean("autoShareLocationOnTrigger", call.getBoolean("autoShareLocationOnTrigger", true) ?: true)
            .putBoolean("autoDialEnabled", call.getBoolean("autoDialEnabled", true) ?: true)
            .putString("userName", call.getString("userName", "OurSafe User"))
            .putString("guardianName", call.getString("guardianName", ""))
            .putString("guardianPhone", call.getString("guardianPhone", ""))
            .putString("policePhone", call.getString("policePhone", "100"))
            .apply()
    }
}
