package com.anonymous.vanDijkFit

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class CreatineWidgetModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "CreatineWidget"

  @ReactMethod
  fun setWidgetData(payloadJson: String, promise: Promise) {
    try {
      CreatineWidgetUpdater.savePayload(reactApplicationContext, payloadJson)
      CreatineWidgetUpdater.refreshWidgets(reactApplicationContext)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("CREATINE_WIDGET_UPDATE_FAILED", error)
    }
  }
}
