package com.anonymous.vanDijkFit

import android.app.PendingIntent
import android.app.AlarmManager
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.net.Uri
import android.util.TypedValue
import android.widget.RemoteViews
import java.util.Calendar
import java.util.Locale
import kotlin.math.roundToInt
import org.json.JSONObject

object CreatineWidgetUpdater {
  const val ACTION_REFRESH_CREATINE_WIDGET = "com.anonymous.vanDijkFit.REFRESH_CREATINE_WIDGET"
  private const val PREFS_NAME = "creatine_widget"
  private const val PREF_PAYLOAD_KEY = "payload"
  private const val BAR_WIDTH_DP = 40f
  private const val BAR_HEIGHT_DP = 282f
  private const val MAINTENANCE_GRAMS = 5.0
  private const val MAINTENANCE_GAIN = 4.0
  private const val LOADING_GRAMS = 20.0
  private const val LOADING_GAIN = 15.0
  private const val MISSED_DAY_DECAY = 3.0

  fun savePayload(context: Context, payloadJson: String) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(PREF_PAYLOAD_KEY, payloadJson)
      .apply()

    scheduleNextMidnightRefresh(context)
  }

  fun refreshWidgets(context: Context, widgetIds: IntArray? = null) {
    val appWidgetManager = AppWidgetManager.getInstance(context)
    val ids = widgetIds ?: appWidgetManager.getAppWidgetIds(
      ComponentName(context, CreatineWidgetProvider::class.java)
    )

    if (ids.isEmpty()) {
      return
    }

    val payload = readPayload(context)
    ids.forEach { widgetId ->
      appWidgetManager.updateAppWidget(widgetId, buildRemoteViews(context, payload))
    }
  }

  private fun readPayload(context: Context): JSONObject? {
    val payloadJson = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getString(PREF_PAYLOAD_KEY, null)
      ?: return null

    return try {
      JSONObject(payloadJson)
    } catch (_: Exception) {
      null
    }
  }

  private fun buildRemoteViews(context: Context, payload: JSONObject?): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.creatine_widget)
    val saturation = calculateSaturation(payload)

    views.setTextViewText(R.id.creatine_widget_percent, "$saturation%")
    views.setImageViewBitmap(R.id.creatine_widget_bar, renderBarBitmap(context, saturation))

    val launchIntent = Intent(
      Intent.ACTION_VIEW,
      Uri.parse("vandijkfit://today?minimizeWorkout=1"),
      context,
      MainActivity::class.java
    ).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }

    views.setOnClickPendingIntent(
      R.id.creatine_widget_root,
      PendingIntent.getActivity(
        context,
        1,
        launchIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    )

    return views
  }

  fun scheduleNextMidnightRefresh(context: Context) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
      ?: return
    val triggerAtMillis = Calendar.getInstance().apply {
      add(Calendar.DAY_OF_YEAR, 1)
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 1)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }.timeInMillis

    alarmManager.setAndAllowWhileIdle(
      AlarmManager.RTC_WAKEUP,
      triggerAtMillis,
      buildRefreshPendingIntent(context)
    )
  }

  fun cancelMidnightRefresh(context: Context) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
      ?: return

    alarmManager.cancel(buildRefreshPendingIntent(context))
  }

  private fun buildRefreshPendingIntent(context: Context): PendingIntent {
    val intent = Intent(context, CreatineWidgetProvider::class.java).apply {
      action = ACTION_REFRESH_CREATINE_WIDGET
    }

    return PendingIntent.getBroadcast(
      context,
      2,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun calculateSaturation(payload: JSONObject?): Int {
    val logs = payload?.optJSONObject("logs")
      ?: return payload?.optInt("saturation", 0)?.coerceIn(0, 100) ?: 0
    val dateKeys = logs.keys().asSequence()
      .filter { logs.optDouble(it, 0.0) > 0.0 }
      .sorted()
      .toList()

    if (dateKeys.isEmpty()) {
      return 0
    }

    val startDate = parseDateKey(dateKeys.first()) ?: return 0
    val targetDate = Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }

    var saturation = 0.0
    val currentDate = startDate.clone() as Calendar

    while (!currentDate.after(targetDate)) {
      val dateKey = formatDateKey(currentDate)
      val grams = logs.optDouble(dateKey, 0.0)
      saturation = (saturation + if (grams > 0.0) {
        getCreatineGainForGrams(grams)
      } else {
        -MISSED_DAY_DECAY
      }).coerceIn(0.0, 100.0)

      currentDate.add(Calendar.DAY_OF_YEAR, 1)
    }

    return saturation.roundToInt()
  }

  private fun getCreatineGainForGrams(grams: Double): Double {
    val safeGrams = grams.coerceAtLeast(0.0)

    if (safeGrams >= LOADING_GRAMS) {
      return LOADING_GAIN
    }

    return (safeGrams / MAINTENANCE_GRAMS) * MAINTENANCE_GAIN
  }

  private fun parseDateKey(dateKey: String): Calendar? {
    val parts = dateKey.split("-").mapNotNull { it.toIntOrNull() }

    if (parts.size != 3) {
      return null
    }

    return Calendar.getInstance().apply {
      set(Calendar.YEAR, parts[0])
      set(Calendar.MONTH, parts[1] - 1)
      set(Calendar.DAY_OF_MONTH, parts[2])
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
  }

  private fun formatDateKey(calendar: Calendar): String =
    String.format(
      Locale.US,
      "%04d-%02d-%02d",
      calendar.get(Calendar.YEAR),
      calendar.get(Calendar.MONTH) + 1,
      calendar.get(Calendar.DAY_OF_MONTH)
    )

  private fun renderBarBitmap(context: Context, saturation: Int): Bitmap {
    val widthPx = dpToPx(context, BAR_WIDTH_DP)
    val heightPx = dpToPx(context, BAR_HEIGHT_DP)
    val output = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(output)
    val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.parseColor("#1B222A")
      style = Paint.Style.FILL
    }
    val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.parseColor("#E8314A")
      style = Paint.Style.FILL
    }
    val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = Color.parseColor("#3B4654")
      style = Paint.Style.STROKE
      strokeWidth = dpToPx(context, 1f).toFloat()
    }
    val radius = dpToPx(context, 26f).toFloat()
    val rect = RectF(1f, 1f, widthPx - 1f, heightPx - 1f)
    val fillHeight = (heightPx - 2f) * (saturation.coerceIn(0, 100) / 100f)
    val fillRect = RectF(1f, heightPx - 1f - fillHeight, widthPx - 1f, heightPx - 1f)

    canvas.drawRoundRect(rect, radius, radius, trackPaint)
    canvas.save()
    canvas.clipRect(fillRect)
    canvas.drawRoundRect(rect, radius, radius, fillPaint)
    canvas.restore()
    canvas.drawRoundRect(rect, radius, radius, borderPaint)

    return output
  }

  private fun dpToPx(context: Context, value: Float): Int =
    TypedValue.applyDimension(
      TypedValue.COMPLEX_UNIT_DIP,
      value,
      context.resources.displayMetrics
    ).toInt()
}
