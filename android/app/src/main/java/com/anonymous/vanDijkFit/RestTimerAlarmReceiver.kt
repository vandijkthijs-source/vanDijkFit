package com.anonymous.vanDijkFit

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import java.util.concurrent.atomic.AtomicBoolean

class RestTimerAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != RestTimerAlarmScheduler.ACTION ||
      !RestTimerAlarmScheduler.consume(context, intent) ||
      RestTimerAlarmScheduler.isForeground) return

    val result = goAsync()
    val handler = Handler(Looper.getMainLooper())
    val finished = AtomicBoolean(false)
    val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    val wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "vDstrong:RestTimer")
    var player: MediaPlayer? = null

    fun finish() {
      if (!finished.compareAndSet(false, true)) return
      handler.removeCallbacksAndMessages(null)
      try {
        player?.release()
      } finally {
        if (wakeLock.isHeld) wakeLock.release()
        result.finish()
      }
    }

    try {
      wakeLock.acquire(5000)
      handler.postDelayed({ finish() }, 4000)
      if (RestTimerAlarmScheduler.shouldVibrate(context)) {
        vibrate(context)
        handler.postDelayed({ finish() }, 600)
        return
      }

      val attributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
      val audio = MediaPlayer.create(
        context, R.raw.rest_timer, attributes, AudioManager.AUDIO_SESSION_ID_GENERATE
      ) ?: throw IllegalStateException("Could not load rest timer chime")
      player = audio
      audio.setOnCompletionListener { finish() }
      audio.setOnErrorListener { _, _, _ ->
        vibrate(context)
        handler.postDelayed({ finish() }, 600)
        true
      }
      audio.start()
    } catch (error: Exception) {
      Log.w("RestTimerAlarm", "Could not play rest timer chime", error)
      try {
        vibrate(context)
        handler.postDelayed({ finish() }, 600)
      } catch (_: Exception) {
        finish()
      }
    }
  }

  @Suppress("DEPRECATION")
  private fun vibrate(context: Context) {
    val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
    } else {
      context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }
    if (!vibrator.hasVibrator()) return
    val pattern = longArrayOf(0, 180, 90, 180)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build()
      vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1), attributes)
    } else {
      vibrator.vibrate(pattern, -1)
    }
  }
}
