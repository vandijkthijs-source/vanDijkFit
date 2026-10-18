package com.anonymous.vanDijkFit

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent

class CreatineWidgetProvider : AppWidgetProvider() {
  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)

    if (intent.action == CreatineWidgetUpdater.ACTION_REFRESH_CREATINE_WIDGET) {
      CreatineWidgetUpdater.refreshWidgets(context)
      CreatineWidgetUpdater.scheduleNextMidnightRefresh(context)
    }
  }

  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray
  ) {
    super.onUpdate(context, appWidgetManager, appWidgetIds)
    CreatineWidgetUpdater.refreshWidgets(context, appWidgetIds)
    CreatineWidgetUpdater.scheduleNextMidnightRefresh(context)
  }

  override fun onEnabled(context: Context) {
    super.onEnabled(context)
    CreatineWidgetUpdater.scheduleNextMidnightRefresh(context)
  }

  override fun onDisabled(context: Context) {
    super.onDisabled(context)
    CreatineWidgetUpdater.cancelMidnightRefresh(context)
  }
}
