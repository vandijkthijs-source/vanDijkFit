package com.anonymous.vanDijkFit

import android.content.ContentValues
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class ReportDownloadsModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "ReportDownloads"

  @ReactMethod
  fun savePdf(sourceUri: String, fileName: String, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      promise.reject("UNSUPPORTED_ANDROID", "Use the folder picker on this Android version.")
      return
    }
    val resolver = context.contentResolver
    var destination: Uri? = null
    try {
      val source = Uri.parse(sourceUri)
      require(source.scheme == "file") { "Expected a local PDF file." }
      val file = File(requireNotNull(source.path)).canonicalFile
      require(file.path.startsWith(context.cacheDir.canonicalPath + File.separator) ||
        file.path.startsWith(context.filesDir.canonicalPath + File.separator)) { "PDF must belong to this app." }
      require(fileName == File(fileName).name && fileName.endsWith(".pdf")) { "Invalid PDF filename." }
      val values = ContentValues().apply {
        put(MediaStore.Downloads.DISPLAY_NAME, fileName)
        put(MediaStore.Downloads.MIME_TYPE, "application/pdf")
        put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
        put(MediaStore.Downloads.IS_PENDING, 1)
      }
      val uri = requireNotNull(resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)) {
        "Could not create the download."
      }
      destination = uri
      requireNotNull(resolver.openOutputStream(uri)).use { output ->
        file.inputStream().use { input -> input.copyTo(output) }
      }
      val published = resolver.update(uri, ContentValues().apply {
        put(MediaStore.Downloads.IS_PENDING, 0)
      }, null, null)
      check(published == 1) { "Could not publish the download." }
      promise.resolve(uri.toString())
    } catch (error: Exception) {
      destination?.let { uri -> runCatching { resolver.delete(uri, null, null) } }
      promise.reject("SAVE_PDF_FAILED", "Could not save PDF to Downloads.", error)
    }
  }
}
