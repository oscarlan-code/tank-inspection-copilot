package ai.laiq.tankinspection.prototype.layoutdrawing

import android.content.Context
import java.io.File

class PrototypeLayoutExportRepository(context: Context) {
    private val appContext = context.applicationContext

    fun exportLatest(draft: PrototypeLayoutDraft): File {
        val dir = File(appContext.filesDir, STORAGE_DIR_NAME).also { it.mkdirs() }
        val file = File(dir, LATEST_FILE_NAME)
        file.writeText(PrototypeLayoutJsonCodec.encode(draft), Charsets.UTF_8)
        return file
    }

    fun readLatestJson(): String? {
        val file = File(File(appContext.filesDir, STORAGE_DIR_NAME), LATEST_FILE_NAME)
        return file.takeIf { it.exists() }?.readText(Charsets.UTF_8)
    }

    fun latestFilePath(): String =
        File(File(appContext.filesDir, STORAGE_DIR_NAME), LATEST_FILE_NAME).absolutePath

    private companion object {
        const val STORAGE_DIR_NAME = "layout-drawing-prototype"
        const val LATEST_FILE_NAME = "latest-layout-draft.json"
    }
}
