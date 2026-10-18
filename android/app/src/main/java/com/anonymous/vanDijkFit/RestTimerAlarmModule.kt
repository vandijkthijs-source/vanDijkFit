package com.anonymous.vanDijkFit

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.common.LifecycleState

internal object RestTimerAlarmScheduler {
  const val ACTION = "com.anonymous.vanDijkFit.REST_TIMER_COMPLETE"
  const val TIMER_KEY = "timerKey"
  const val ENDS_AT = "endsAt"
  private const val PREFERENCES = "rest_timer_alarm"
  const val PERMISSION_REQUESTED = "permissionRequested"

  @Volatile var isForeground = false

  fun preferences(context: Context) =
    context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

  private fun alarmManager(context: Context) =
    context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  fun canScheduleExact(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager(context).canScheduleExactAlarms()

  @Synchronized
  fun schedule(context: Context, timerKey: String, endsAt: Long): Boolean {
    cancel(context)
    if (endsAt <= System.currentTimeMillis()) return true

    val intent = Intent(context, RestTimerAlarmReceiver::class.java)
      .setAction(ACTION)
      .putExtra(TIMER_KEY, timerKey)
      .putExtra(ENDS_AT, endsAt)
    val pendingIntent = PendingIntent.getBroadcast(
      context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    preferences(context).edit().putString(TIMER_KEY, timerKey).putLong(ENDS_AT, endsAt).commit()

    val manager = alarmManager(context)
    if (canScheduleExact(context)) {
      try {
        manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAt, pendingIntent)
        return true
      } catch (_: SecurityException) {
        // Permission can be revoked between checking and scheduling.
      }
    }
    manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAt, pendingIntent)
    return false
  }

  @Synchronized
  fun cancel(context: Context) {
    preferences(context).edit().remove(TIMER_KEY).remove(ENDS_AT).commit()
    val intent = Intent(context, RestTimerAlarmReceiver::class.java).setAction(ACTION)
    PendingIntent.getBroadcast(
      context, 0, intent, PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
    )?.let {
      alarmManager(context).cancel(it)
      it.cancel()
    }
  }

  @Synchronized
  fun consume(context: Context, intent: Intent): Boolean {
    val prefs = preferences(context)
    val timerKey = intent.getStringExtra(TIMER_KEY) ?: return false
    val endsAt = intent.getLongExtra(ENDS_AT, 0)
    if (prefs.getString(TIMER_KEY, null) != timerKey || prefs.getLong(ENDS_AT, 0) != endsAt) {
      return false
    }
    if (endsAt > System.currentTimeMillis() + 100) return false
    prefs.edit().remove(TIMER_KEY).remove(ENDS_AT).commit()
    return true
  }

  @Synchronized
  fun cancelIfMatches(context: Context, timerKey: String) {
    if (preferences(context).getString(TIMER_KEY, null) == timerKey) cancel(context)
  }

  @Synchronized
  fun reschedulePending(context: Context) {
    val prefs = preferences(context)
    val timerKey = prefs.getString(TIMER_KEY, null) ?: return
    schedule(context, timerKey, prefs.getLong(ENDS_AT, 0))
  }

  fun shouldVibrate(context: Context): Boolean {
    val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    return audio.ringerMode != AudioManager.RINGER_MODE_NORMAL ||
      audio.getStreamVolume(AudioManager.STREAM_MUSIC) == 0
  }
}

class RestTimerAlarmModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext), LifecycleEventListener {
  init {
    RestTimerAlarmScheduler.isForeground = reactContext.lifecycleState == LifecycleState.RESUMED
    reactContext.addLifecycleEventListener(this)
  }

  override fun getName(): String = "RestTimerAlarm"

  @ReactMethod
  fun scheduleTimer(timerKey: String, endsAt: Double, promise: Promise) {
    try {
      require(endsAt.isFinite()) { "Invalid timer deadline" }
      promise.resolve(RestTimerAlarmScheduler.schedule(reactApplicationContext, timerKey, endsAt.toLong()))
    } catch (error: Exception) {
      promise.reject("REST_TIMER_SCHEDULE_FAILED", error)
    }
  }

  @ReactMethod
  fun cancelTimer(promise: Promise) {
    try {
      RestTimerAlarmScheduler.cancel(reactApplicationContext)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("REST_TIMER_CANCEL_FAILED", error)
    }
  }

  @ReactMethod
  fun cancelTimerForKey(timerKey: String, promise: Promise) {
    try {
      RestTimerAlarmScheduler.cancelIfMatches(reactApplicationContext, timerKey)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("REST_TIMER_CANCEL_FAILED", error)
    }
  }

  @ReactMethod
  fun shouldVibrate(promise: Promise) {
    try {
      promise.resolve(RestTimerAlarmScheduler.shouldVibrate(reactApplicationContext))
    } catch (error: Exception) {
      promise.reject("REST_TIMER_AUDIO_STATE_FAILED", error)
    }
  }

  @ReactMethod
  fun requestExactAlarmPermission(promise: Promise) {
    val context = reactApplicationContext
    val prefs = RestTimerAlarmScheduler.preferences(context)
    if (RestTimerAlarmScheduler.canScheduleExact(context) ||
      prefs.getBoolean(RestTimerAlarmScheduler.PERMISSION_REQUESTED, false)) {
      promise.resolve(false)
      return
    }
    context.runOnUiQueueThread {
      val activity = context.currentActivity
      if (activity == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        promise.resolve(false)
      } else {
        try {
          activity.startActivity(Intent(
            Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
            Uri.parse("package:" + context.packageName)
          ))
          prefs.edit().putBoolean(RestTimerAlarmScheduler.PERMISSION_REQUESTED, true).apply()
          promise.resolve(true)
        } catch (error: Exception) {
          promise.reject("REST_TIMER_PERMISSION_FAILED", error)
        }
      }
    }
  }

  override fun onHostResume() {
    RestTimerAlarmScheduler.isForeground = true
    try {
      RestTimerAlarmScheduler.reschedulePending(reactApplicationContext)
    } catch (error: Exception) {
      Log.w("RestTimerAlarm", "Could not restore rest timer", error)
    }
  }

  override fun onHostPause() {
    RestTimerAlarmScheduler.isForeground = false
  }

  override fun onHostDestroy() {
    RestTimerAlarmScheduler.isForeground = false
  }

  override fun invalidate() {
    reactApplicationContext.removeLifecycleEventListener(this)
    RestTimerAlarmScheduler.isForeground = false
    super.invalidate()
  }
}
