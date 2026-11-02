package com.kitbag.corenative.library

import androidx.core.content.FileProvider

// Its own class so the manifest merger never collides with another library's FileProvider.
class BackupFileProvider : FileProvider()
