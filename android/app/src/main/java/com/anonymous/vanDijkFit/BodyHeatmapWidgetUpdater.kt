package com.anonymous.vanDijkFit

import android.app.PendingIntent
import android.app.AlarmManager
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.net.Uri
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import androidx.core.graphics.PathParser
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

object BodyHeatmapWidgetUpdater {
  const val ACTION_TOGGLE_SIDE = "com.anonymous.vanDijkFit.ACTION_TOGGLE_BODY_HEATMAP_SIDE"
  const val ACTION_REFRESH_BODY_HEATMAP_WIDGET = "com.anonymous.vanDijkFit.REFRESH_BODY_HEATMAP_WIDGET"

  private const val PREFS_NAME = "body_heatmap_widget"
  private const val PREF_PAYLOAD_KEY = "payload"
  private const val PREF_SIDE_PREFIX = "side_"
  private const val BODY_WIDTH_DP = 110f
  private const val BODY_HEIGHT_DP = 276f

  private data class RegionDefinition(
    val label: String,
    val pathData: String,
  )

  private data class HeatmapSideDefinition(
    val drawableRes: Int,
    val assetPath: String,
    val viewBoxWidth: Float,
    val viewBoxHeight: Float,
    val translateX: Float,
    val translateY: Float,
  )

  private val frontDefinition = HeatmapSideDefinition(
    drawableRes = R.drawable.front_man_widget,
    assetPath = "body_widget/front_regions.json",
    viewBoxWidth = 90.918526f,
    viewBoxHeight = 228.9595f,
    translateX = -55.878793f,
    translateY = -5.576227f,
  )
  private val backDefinition = HeatmapSideDefinition(
    drawableRes = R.drawable.back_man_widget,
    assetPath = "body_widget/back_regions.json",
    viewBoxWidth = 94.834854f,
    viewBoxHeight = 237.66541f,
    translateX = -55.139989f,
    translateY = -9.9042451f,
  )

  @Volatile
  private var cachedFrontRegions: List<RegionDefinition>? = null

  @Volatile
  private var cachedBackRegions: List<RegionDefinition>? = null

  fun savePayload(context: Context, payloadJson: String) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(PREF_PAYLOAD_KEY, payloadJson)
      .apply()

    scheduleNextMidnightRefresh(context)
  }

  fun toggleSide(context: Context, widgetId: Int) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val currentSide = prefs.getString("${PREF_SIDE_PREFIX}$widgetId", "front")
    val nextSide = if (currentSide == "back") "front" else "back"

    prefs.edit()
      .putString("${PREF_SIDE_PREFIX}$widgetId", nextSide)
      .apply()
  }

  fun toggleAllWidgets(context: Context) {
    val appWidgetManager = AppWidgetManager.getInstance(context)
    val ids = appWidgetManager.getAppWidgetIds(
      ComponentName(context, BodyHeatmapWidgetProvider::class.java)
    )

    ids.forEach { toggleSide(context, it) }
  }

  fun refreshWidgets(context: Context, widgetIds: IntArray? = null) {
    val appWidgetManager = AppWidgetManager.getInstance(context)
    val ids = widgetIds ?: appWidgetManager.getAppWidgetIds(
      ComponentName(context, BodyHeatmapWidgetProvider::class.java)
    )

    if (ids.isEmpty()) {
      return
    }

    val payload = readPayload(context)
    ids.forEach { widgetId ->
      appWidgetManager.updateAppWidget(widgetId, buildRemoteViews(context, payload, widgetId))
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

  private fun buildRemoteViews(context: Context, payload: JSONObject?, widgetId: Int): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.body_heatmap_widget)
    val showBack = readSide(context, widgetId) == "back"
    val currentPayload = selectCurrentPayload(payload)
    val emptyMessage = currentPayload?.optString("emptyMessage").orEmpty()
    val hasData = currentPayload?.optBoolean("hasData", false) ?: false
    val bitmap = renderHeatmapBitmap(context, currentPayload, showBack)

    views.setTextViewText(R.id.widget_side_toggle, if (showBack) "SHOW FRONT" else "SHOW BACK")
    views.setTextViewText(R.id.widget_empty_message, emptyMessage)
    views.setViewVisibility(
      R.id.widget_empty_message,
      if (!hasData && emptyMessage.isNotBlank()) View.VISIBLE else View.GONE
    )
    views.setImageViewBitmap(R.id.widget_body_image, bitmap)

    val launchIntent = Intent(
      Intent.ACTION_VIEW,
      Uri.parse("vandijkfit://body-map?minimizeWorkout=1"),
      context,
      MainActivity::class.java
    ).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }

    val pendingIntent = PendingIntent.getActivity(
      context,
      0,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val toggleIntent = Intent(context, BodyHeatmapWidgetProvider::class.java).apply {
      action = ACTION_TOGGLE_SIDE
      putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
    }

    views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)
    views.setOnClickPendingIntent(
      R.id.widget_side_toggle,
      PendingIntent.getBroadcast(
        context,
        widgetId,
        toggleIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    )
    return views
  }

  private fun selectCurrentPayload(payload: JSONObject?): JSONObject? {
    val dateKey = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().time)
    return payload?.optJSONObject("daily")?.optJSONObject(dateKey) ?: payload
  }

  fun scheduleNextMidnightRefresh(context: Context) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
      ?: return
    val triggerAtMillis = Calendar.getInstance().apply {
      add(Calendar.DAY_OF_YEAR, 1)
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 2)
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
    val intent = Intent(context, BodyHeatmapWidgetProvider::class.java).apply {
      action = ACTION_REFRESH_BODY_HEATMAP_WIDGET
    }
    return PendingIntent.getBroadcast(
      context,
      3,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun renderHeatmapBitmap(
    context: Context,
    payload: JSONObject?,
    showBack: Boolean
  ): Bitmap {
    val sideKey = if (showBack) "back" else "front"
    val definition = if (showBack) backDefinition else frontDefinition
    val regions = loadRegions(context, showBack)
    val regionStates = payload
      ?.optJSONObject("regions")
      ?.optJSONObject(sideKey)
      ?: JSONObject()

    val widthPx = dpToPx(context, BODY_WIDTH_DP)
    val heightPx = dpToPx(context, BODY_HEIGHT_DP)
    val bodyBitmap = BitmapFactory.decodeResource(context.resources, definition.drawableRes)
    val output = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(output)
    val imagePaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    val overlayPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.FILL
    }

    canvas.drawBitmap(
      bodyBitmap,
      null,
      android.graphics.Rect(0, 0, widthPx, heightPx),
      imagePaint
    )

    val transform = Matrix().apply {
      postTranslate(definition.translateX, definition.translateY)
      postScale(
        widthPx / definition.viewBoxWidth,
        heightPx / definition.viewBoxHeight
      )
    }

    regions.forEach { region ->
      val regionState = regionStates.optJSONObject(region.label) ?: return@forEach
      val intensity = regionState.optDouble("intensity", 0.0).toFloat().coerceIn(0f, 1f)
      if (intensity <= 0f) {
        return@forEach
      }

      val isNewPr = regionState.optBoolean("isNewPr", false)
      val fill = regionState.optString(
        "fill",
        if (isNewPr) "#ff394f" else "#f13e50"
      )
      val opacity = if (regionState.has("opacity")) {
        regionState.optDouble("opacity", 0.0).toFloat().coerceIn(0f, 1f)
      } else {
        ((48f + intensity * 175f) / 255f).coerceIn(0f, 1f)
      }
      overlayPaint.color = Color.parseColor(fill)
      overlayPaint.alpha = (opacity * 255f).toInt().coerceIn(0, 255)

      val path = PathParser.createPathFromPathData(region.pathData) ?: return@forEach
      path.transform(transform)
      canvas.drawPath(path, overlayPaint)
    }

    return output
  }

  private fun loadRegions(context: Context, showBack: Boolean): List<RegionDefinition> {
    val cached = if (showBack) cachedBackRegions else cachedFrontRegions
    if (cached != null) {
      return cached
    }

    val definition = if (showBack) backDefinition else frontDefinition
    val parsed = context.assets.open(definition.assetPath).bufferedReader().use { reader ->
      val array = org.json.JSONArray(reader.readText())
      buildList {
        for (index in 0 until array.length()) {
          val item = array.getJSONObject(index)
          add(
            RegionDefinition(
              label = item.getString("label"),
              pathData = item.getString("d")
            )
          )
        }
      }
    }

    if (showBack) {
      cachedBackRegions = parsed
    } else {
      cachedFrontRegions = parsed
    }

    return parsed
  }

  private fun readSide(context: Context, widgetId: Int): String =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getString("${PREF_SIDE_PREFIX}$widgetId", "front")
      ?: "front"

  fun clearWidget(context: Context, widgetId: Int) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .remove("${PREF_SIDE_PREFIX}$widgetId")
      .apply()
  }

  private fun dpToPx(context: Context, value: Float): Int =
    TypedValue.applyDimension(
      TypedValue.COMPLEX_UNIT_DIP,
      value,
      context.resources.displayMetrics
    ).toInt()
}
