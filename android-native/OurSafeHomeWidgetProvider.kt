package app.oursafe.safety.shield

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

/**
 * OurSafeHomeWidgetProvider
 *
 * Native Android Phone Home Screen Widget providing 1-tap Emergency SOS Call
 * and Lock-Screen Shield arming directly on the phone's Home Screen.
 */
class OurSafeHomeWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            val sosIntent = Intent(context, OurSafeBackgroundShieldService::class.java).apply {
                action = OurSafeBackgroundShieldService.ACTION_TRIGGER_SOS
                putExtra("kind", "screen_tap")
                putExtra("label", "Home Screen SOS Widget")
                putExtra("detail", "Triggered directly from OurSafe Home Screen Widget.")
                putExtra("surface", "home_screen")
            }
            val pendingSos = PendingIntent.getService(
                context,
                appWidgetId,
                sosIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val views = RemoteViews(context.packageName, android.R.layout.simple_list_item_1).apply {
                setTextViewText(android.R.id.text1, "OurSafe SOS — Tap for Guardian & Police")
                setOnClickPendingIntent(android.R.id.text1, pendingSos)
            }
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
