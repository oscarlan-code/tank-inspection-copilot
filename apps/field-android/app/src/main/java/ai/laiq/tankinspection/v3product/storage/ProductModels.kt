package ai.laiq.tankinspection.v3product.storage

enum class ProductWorkflowScreen(val key: String, val label: String) {
    TASK_HOME("task_home", "Task Home"),
    GENERAL_INFO("general_info", "General Tank Information"),
    LAYOUT_SCOPE("layout_scope", "Layout Scope"),
    LAYOUT_MAP_SETUP("layout_map_setup", "Layout Map Setup"),
    ELEMENT_SETUP("element_setup", "Element Setup"),
    ELEMENT_PLACEMENT("element_placement", "Element Placement"),
    UT_SETUP("ut_setup", "UT Scope"),
    UT_MEASUREMENT("ut_measurement", "UT Measurements"),
    CHECKLIST("checklist", "Inspection Checklist"),
    FINDINGS("findings", "Findings"),
    ;

    companion object {
        fun fromKey(key: String): ProductWorkflowScreen =
            entries.firstOrNull { screen -> screen.key == key } ?: GENERAL_INFO
    }
}

enum class ProductTaskLifecycle(val key: String) {
    ONGOING("ongoing"),
    ARCHIVED("archived"),
}

data class ProductLocalProfile(
    val tenantId: String,
    val tenantName: String,
    val workspaceId: String,
    val workspaceName: String,
    val userId: String,
    val displayName: String,
    val roleLabel: String,
    val deviceId: String,
)

data class ProductTaskIdentity(
    val inspectionId: String,
    val inspectionReference: String,
    val tenantId: String,
    val workspaceId: String,
    val createdByUserId: String,
    val lastEditedByUserId: String,
    val deviceId: String,
    val createdAtIso: String,
)

data class ProductTaskSummary(
    val inspectionId: String,
    val inspectionReference: String,
    val client: String,
    val tankNumber: String,
    val location: String,
    val lifecycle: ProductTaskLifecycle,
    val currentScreen: ProductWorkflowScreen,
    val readinessStatusCode: String,
    val readinessStatusLabel: String,
    val exportStatusCode: String,
    val exportStatusLabel: String,
    val updatedAtIso: String,
)

data class ProductExportValidationCheck(
    val ruleCode: String,
    val ruleLabel: String,
    val passed: Boolean,
    val blocksExport: Boolean,
    val message: String,
)

data class ProductExportPackageSummary(
    val exportPackageId: String,
    val inspectionId: String,
    val inspectionReference: String,
    val schemaVersion: Int,
    val exportedByUserId: String,
    val exportedAtIso: String,
    val fileRelativePath: String,
    val fileByteSize: Long?,
    val validationStatusCode: String,
    val validationStatusLabel: String,
)
