package com.anonymous.vanDijkFit

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class BodyHeatmapWidgetModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "BodyHeatmapWidget"

  @ReactMethod
  fun setWidgetData(payloadJson: String, promise: Promise) {
    try {
      BodyHeatmapWidgetUpdater.savePayload(reactApplicationContext, payloadJson)
      BodyHeatmapWidgetUpdater.refreshWidgets(reactApplicationContext)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("BODY_HEATMAP_WIDGET_UPDATE_FAILED", error)
    }
  }
}
