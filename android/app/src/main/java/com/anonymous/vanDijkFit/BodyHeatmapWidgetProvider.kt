package com.anonymous.vanDijkFit

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Intent
import android.content.Context

class BodyHeatmapWidgetProvider : AppWidgetProvider() {
  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)

    if (intent.action == BodyHeatmapWidgetUpdater.ACTION_TOGGLE_SIDE) {
      val widgetId = intent.getIntExtra(
        AppWidgetManager.EXTRA_APPWIDGET_ID,
        AppWidgetManager.INVALID_APPWIDGET_ID
      )

      if (widgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
        BodyHeatmapWidgetUpdater.toggleSide(context, widgetId)
        BodyHeatmapWidgetUpdater.refreshWidgets(context, intArrayOf(widgetId))
      } else {
        BodyHeatmapWidgetUpdater.toggleAllWidgets(context)
        BodyHeatmapWidgetUpdater.refreshWidgets(context)
      }
    }

    if (intent.action == BodyHeatmapWidgetUpdater.ACTION_REFRESH_BODY_HEATMAP_WIDGET) {
      BodyHeatmapWidgetUpdater.refreshWidgets(context)
      BodyHeatmapWidgetUpdater.scheduleNextMidnightRefresh(context)
    }
  }

  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    super.onUpdate(context, appWidgetManager, appWidgetIds)
    BodyHeatmapWidgetUpdater.refreshWidgets(context, appWidgetIds)
    BodyHeatmapWidgetUpdater.scheduleNextMidnightRefresh(context)
  }

  override fun onEnabled(context: Context) {
    super.onEnabled(context)
    BodyHeatmapWidgetUpdater.scheduleNextMidnightRefresh(context)
  }

  override fun onDisabled(context: Context) {
    super.onDisabled(context)
    BodyHeatmapWidgetUpdater.cancelMidnightRefresh(context)
  }

  override fun onDeleted(context: Context, appWidgetIds: IntArray) {
    super.onDeleted(context, appWidgetIds)
    appWidgetIds.forEach { BodyHeatmapWidgetUpdater.clearWidget(context, it) }
  }
}
