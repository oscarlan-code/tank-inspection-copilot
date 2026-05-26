package ai.laiq.tankinspection

import ai.laiq.tankinspection.data.local.AppSessionStore
import ai.laiq.tankinspection.presentation.components.LaiqColors
import ai.laiq.tankinspection.presentation.components.LaiqDeleteConfirmDialog
import ai.laiq.tankinspection.presentation.components.LaiqDeleteDialogState
import ai.laiq.tankinspection.presentation.components.LaiqFieldTheme
import ai.laiq.tankinspection.data.local.SavedAppSession
import ai.laiq.tankinspection.data.local.db.InspectionRecordEntity
import ai.laiq.tankinspection.presentation.commitFundamentalInputs
import ai.laiq.tankinspection.presentation.currentInspectionId
import ai.laiq.tankinspection.presentation.currentShellCaptureStartLaneId
import ai.laiq.tankinspection.presentation.defaultDemoInspectionScenarioId
import ai.laiq.tankinspection.presentation.demoInspectionScenarioDescription
import ai.laiq.tankinspection.presentation.demoInspectionScenarioOptions
import ai.laiq.tankinspection.presentation.hasPendingFundamentalChanges
import ai.laiq.tankinspection.presentation.hasPendingShellPlanningChanges
import ai.laiq.tankinspection.presentation.FieldDraftState
import ai.laiq.tankinspection.presentation.isMaterialInspectionDraft
import ai.laiq.tankinspection.presentation.loadDemoInspectionScenario
import ai.laiq.tankinspection.presentation.ProductScreen
import ai.laiq.tankinspection.presentation.ROOF_SURFACE_FIXED
import ai.laiq.tankinspection.presentation.ROOF_SURFACE_FLOATING
import ai.laiq.tankinspection.presentation.recommendedLineCount
import ai.laiq.tankinspection.presentation.saveRoofLayoutDraft
import ai.laiq.tankinspection.presentation.validationErrors
import ai.laiq.tankinspection.presentation.screens.FindingsScreen
import ai.laiq.tankinspection.presentation.screens.ExportScreen
import ai.laiq.tankinspection.presentation.screens.InspectionScopeScreen
import ai.laiq.tankinspection.presentation.screens.InspectionSetupScreen
import ai.laiq.tankinspection.presentation.screens.MflImportScreen
import ai.laiq.tankinspection.presentation.screens.PlumbnessSurveyScreen
import ai.laiq.tankinspection.presentation.screens.ReviewScreen
import ai.laiq.tankinspection.presentation.screens.RoundnessSurveyScreen
import ai.laiq.tankinspection.presentation.screens.RoofLayoutScreen
import ai.laiq.tankinspection.presentation.screens.RoofUtScreen
import ai.laiq.tankinspection.presentation.screens.RoofNozzleUtScreen
import ai.laiq.tankinspection.presentation.screens.ShellUtScreen
import ai.laiq.tankinspection.presentation.screens.ShellSettlementScreen
import ai.laiq.tankinspection.presentation.screens.ShellNozzleUtScreen
import ai.laiq.tankinspection.presentation.screens.TaskBoardScreen
import ai.laiq.tankinspection.presentation.StartReference
import ai.laiq.tankinspection.presentation.syncTemplateToSurface
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Modifier
import kotlinx.coroutines.launch

private fun ProductScreen.systemBackTarget(
    findingsReturnScreen: ProductScreen,
    scopeReturnScreen: ProductScreen,
): ProductScreen? =
    when {
        this == ProductScreen.Setup -> null
        name == "GeneralTankInfo" -> ProductScreen.Setup
        this == ProductScreen.Scope -> scopeReturnScreen
        this == ProductScreen.TaskBoard -> ProductScreen.Scope
        this == ProductScreen.RoofLayout ||
            this == ProductScreen.ShellUt ||
            this == ProductScreen.ShellSettlement ||
            this == ProductScreen.RoundnessSurvey ||
            this == ProductScreen.PlumbnessSurvey ||
            this == ProductScreen.RoofUt ||
            this == ProductScreen.ShellNozzleUt ||
            this == ProductScreen.RoofNozzleUt ||
            this == ProductScreen.Review ||
            this == ProductScreen.MflImport -> ProductScreen.TaskBoard
        this == ProductScreen.Findings -> findingsReturnScreen
        this == ProductScreen.Export -> ProductScreen.Review
        else -> ProductScreen.Setup
    }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LaiqFieldAndroidApp() {
    val context = LocalContext.current.applicationContext
    val appSessionStore = remember(context) { AppSessionStore(context) }
    var currentScreen by remember { mutableStateOf(ProductScreen.Setup) }
    var draftState by remember { mutableStateOf(FieldDraftState()) }
    var findingsReturnScreen by remember { mutableStateOf(ProductScreen.TaskBoard) }
    var scopeReturnScreen by remember { mutableStateOf(ProductScreen.Setup) }
    var hasLoadedSession by remember { mutableStateOf(false) }
    var selectedDemoScenarioId by remember { mutableStateOf(defaultDemoInspectionScenarioId()) }
    var localInspections by remember { mutableStateOf<List<InspectionRecordEntity>>(emptyList()) }
    var inspectionListRefreshKey by remember { mutableStateOf(0) }
    var savedInspectionNotice by remember { mutableStateOf<String?>(null) }
    var pendingSetupContinue by remember { mutableStateOf<LaiqDeleteDialogState?>(null) }
    val demoScenarioOptions = remember { demoInspectionScenarioOptions() }
    val coroutineScope = rememberCoroutineScope()

    fun openFindings(nextDraftState: FieldDraftState, returnScreen: ProductScreen) {
        draftState = nextDraftState
        findingsReturnScreen = returnScreen
        currentScreen = ProductScreen.Findings
    }

    fun continueFromSetup() {
        savedInspectionNotice = null
        scopeReturnScreen = ProductScreen.Setup
        draftState = draftState.commitFundamentalInputs()
            .saveRoofLayoutDraft(ROOF_SURFACE_FIXED)
            .saveRoofLayoutDraft(ROOF_SURFACE_FLOATING)
        currentScreen = ProductScreen.Scope
    }

    val systemBackTarget = currentScreen.systemBackTarget(findingsReturnScreen, scopeReturnScreen)

    BackHandler(enabled = systemBackTarget != null) {
        currentScreen = systemBackTarget ?: return@BackHandler
    }

    LaunchedEffect(appSessionStore) {
        val savedSession = appSessionStore.load()
        if (savedSession != null) {
            currentScreen =
                if (savedSession.currentScreen == ProductScreen.MflImport) {
                    ProductScreen.TaskBoard
                } else if (savedSession.currentScreen.name == "GeneralTankInfo") {
                    ProductScreen.Setup
                } else {
                    savedSession.currentScreen
                }
            draftState = savedSession.draftState
        }
        localInspections = appSessionStore.listInspections()
        hasLoadedSession = true
    }

    LaunchedEffect(currentScreen, draftState, hasLoadedSession) {
        if (!hasLoadedSession) return@LaunchedEffect
        appSessionStore.save(
            SavedAppSession(
                currentScreen = currentScreen,
                draftState = draftState,
            ),
        )
        if (currentScreen == ProductScreen.Setup) {
            localInspections = appSessionStore.listInspections()
        }
    }

    LaunchedEffect(currentScreen, inspectionListRefreshKey, hasLoadedSession) {
        if (!hasLoadedSession) return@LaunchedEffect
        if (currentScreen == ProductScreen.Setup) {
            localInspections = appSessionStore.listInspections()
        }
    }

    LaiqFieldTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
            pendingSetupContinue?.let { dialogState ->
                LaiqDeleteConfirmDialog(
                    state = dialogState,
                    onDismiss = { pendingSetupContinue = null },
                )
            }
            Scaffold(
                topBar = {
                    TopAppBar(
                        colors = TopAppBarDefaults.topAppBarColors(
                            containerColor = MaterialTheme.colorScheme.background,
                            titleContentColor = LaiqColors.BrandTeal,
                        ),
                        navigationIcon = {
                            systemBackTarget?.let { backTarget ->
                                TextButton(onClick = { currentScreen = backTarget }) {
                                    Text("Back")
                                }
                            }
                        },
                        title = {
                            Text(
                                when {
                                    currentScreen == ProductScreen.Setup || currentScreen.name == "GeneralTankInfo" -> "Inspection Setup"
                                    currentScreen == ProductScreen.Scope -> "Inspection Scope"
                                    currentScreen == ProductScreen.TaskBoard -> "Task Board"
                                    currentScreen == ProductScreen.RoofLayout -> "Roof Elements"
                                    currentScreen == ProductScreen.ShellUt -> "Shell UT"
                                    currentScreen == ProductScreen.ShellSettlement -> "Shell Settlement"
                                    currentScreen == ProductScreen.RoundnessSurvey -> "Roundness Survey"
                                    currentScreen == ProductScreen.PlumbnessSurvey -> "Plumbness Survey"
                                    currentScreen == ProductScreen.RoofUt -> "Roof UT"
                                    currentScreen == ProductScreen.ShellNozzleUt -> "Shell Nozzles"
                                    currentScreen == ProductScreen.RoofNozzleUt -> "Roof Nozzles"
                                    currentScreen == ProductScreen.Findings -> "Findings"
                                    currentScreen == ProductScreen.Review -> "Review"
                                    currentScreen == ProductScreen.Export -> "Export"
                                    currentScreen == ProductScreen.MflImport -> "Bottom MFL"
                                    else -> "Inspection Setup"
                                },
                            )
                        },
                    )
                },
            ) { innerPadding ->
                when {
                    currentScreen == ProductScreen.Setup || currentScreen.name == "GeneralTankInfo" -> {
                        InspectionSetupScreen(
                            state = draftState.setup,
                            scopeState = draftState.scope,
                            fixedRoofLayoutDraft = draftState.fixedRoofLayoutDraft,
                            floatingRoofLayoutDraft = draftState.floatingRoofLayoutDraft,
                            lineCountOverride = draftState.shellLineCountOverride,
                            shellCaptureStartLaneId = draftState.currentShellCaptureStartLaneId(),
                            recommendedLineCount = draftState.recommendedLineCount(),
                            hasPendingFundamentalChanges = draftState.hasPendingFundamentalChanges(),
                            hasPendingShellPlanningChanges = draftState.hasPendingShellPlanningChanges(),
                            onStateChange = { updatedSetup ->
                                draftState = draftState.copy(
                                    setup = updatedSetup,
                                    fixedRoofLayoutDraft = draftState.fixedRoofLayoutDraft.syncTemplateToSurface(updatedSetup, ROOF_SURFACE_FIXED),
                                    floatingRoofLayoutDraft = draftState.floatingRoofLayoutDraft.syncTemplateToSurface(updatedSetup, ROOF_SURFACE_FLOATING),
                                )
                            },
                            onScopeStateChange = {
                                draftState = draftState.copy(scope = it.copy(startReference = StartReference.N))
                            },
                            onFixedRoofLayoutDraftChange = {
                                draftState = draftState.copy(fixedRoofLayoutDraft = it)
                            },
                            onFloatingRoofLayoutDraftChange = {
                                draftState = draftState.copy(floatingRoofLayoutDraft = it)
                            },
                            onLineCountOverrideChange = {
                                draftState = draftState.copy(shellLineCountOverride = it)
                            },
                            onShellCaptureStartLaneIdChange = {
                                draftState = draftState.copy(shellCaptureStartLaneId = it)
                            },
                            onContinue = {
                                val validationErrors = draftState.validationErrors()
                                if (validationErrors.isEmpty()) {
                                    val destructiveMessage = when {
                                        draftState.hasPendingFundamentalChanges() ->
                                            "This change will clear roof layout, shell and roof measurements, nozzle data, and findings so capture can restart from the new foundation."
                                        draftState.hasPendingShellPlanningChanges() ->
                                            "This change will clear shell-side measurements, shell nozzle data, and related findings."
                                        else -> null
                                    }

                                    if (destructiveMessage != null) {
                                        pendingSetupContinue = LaiqDeleteDialogState(
                                            title = "Reset downstream capture?",
                                            message = destructiveMessage,
                                            confirmText = "Continue",
                                            onConfirm = { continueFromSetup() },
                                        )
                                    } else {
                                        continueFromSetup()
                                    }
                                }
                            },
                            sampleScenarioOptions = demoScenarioOptions,
                            selectedSampleScenarioId = selectedDemoScenarioId,
                            selectedSampleScenarioDescription = demoInspectionScenarioDescription(selectedDemoScenarioId),
                            onSelectedSampleScenarioChange = { selectedDemoScenarioId = it },
                            onLoadSampleData = {
                                savedInspectionNotice = null
                                draftState = loadDemoInspectionScenario(selectedDemoScenarioId)
                                currentScreen = ProductScreen.Setup
                                inspectionListRefreshKey++
                            },
                            onStartNewInspection = {
                                savedInspectionNotice = null
                                draftState = FieldDraftState()
                                currentScreen = ProductScreen.Setup
                                inspectionListRefreshKey++
                            },
                            localInspections = localInspections,
                            activeInspectionId = draftState.currentInspectionId().takeIf { draftState.isMaterialInspectionDraft() },
                            savedInspectionNotice = savedInspectionNotice,
                            onOpenInspection = { inspectionId ->
                                coroutineScope.launch {
                                    val savedInspection = appSessionStore.loadInspection(inspectionId)
                                    if (savedInspection != null) {
                                        savedInspectionNotice = null
                                        draftState = savedInspection.draftState
                                        currentScreen =
                                            if (savedInspection.currentScreen.name == "GeneralTankInfo") {
                                                ProductScreen.Setup
                                            } else {
                                                savedInspection.currentScreen
                                            }
                                        inspectionListRefreshKey++
                                    } else {
                                        savedInspectionNotice =
                                            "This saved inspection is no longer restorable from local structured storage."
                                    }
                                }
                            },
                            contentPadding = innerPadding,
                        )
                    }

                    currentScreen == ProductScreen.Scope -> {
                        InspectionScopeScreen(
                            state = draftState.scope,
                            onStateChange = { draftState = draftState.copy(scope = it) },
                            onBack = { currentScreen = scopeReturnScreen },
                            onContinue = {
                                draftState = draftState.commitFundamentalInputs()
                                currentScreen = ProductScreen.TaskBoard
                            },
                            contentPadding = innerPadding,
                        )
                    }

                    currentScreen == ProductScreen.TaskBoard -> {
                        TaskBoardScreen(
                            draftState = draftState,
                            onOpenRoofElements = { currentScreen = ProductScreen.RoofLayout },
                            onOpenShellUt = { currentScreen = ProductScreen.ShellUt },
                            onOpenShellSettlement = { currentScreen = ProductScreen.ShellSettlement },
                            onOpenRoundnessSurvey = { currentScreen = ProductScreen.RoundnessSurvey },
                            onOpenPlumbnessSurvey = { currentScreen = ProductScreen.PlumbnessSurvey },
                            onOpenRoofUt = { currentScreen = ProductScreen.RoofUt },
                            onOpenShellNozzleUt = { currentScreen = ProductScreen.ShellNozzleUt },
                            onOpenRoofNozzleUt = { currentScreen = ProductScreen.RoofNozzleUt },
                            onOpenReview = { currentScreen = ProductScreen.Review },
                            onOpenMflImport = { currentScreen = ProductScreen.MflImport },
                            onBack = { currentScreen = ProductScreen.Scope },
                            contentPadding = innerPadding,
                        )
                    }

                    currentScreen == ProductScreen.RoofLayout -> {
                        RoofLayoutScreen(
                            draftState = draftState,
                            onDraftStateChange = { draftState = it },
                            onBack = { currentScreen = ProductScreen.TaskBoard },
                            contentPadding = innerPadding,
                        )
                    }

                    currentScreen == ProductScreen.ShellUt -> {
                        ShellUtScreen(
                            draftState = draftState,
                            onDraftStateChange = { draftState = it },
                            onOpenFindings = { nextDraftState -> openFindings(nextDraftState, ProductScreen.ShellUt) },
                            onBack = { currentScreen = ProductScreen.TaskBoard },
                            contentPadding = innerPadding,
                        )
                    }

                    currentScreen == ProductScreen.ShellSettlement -> {
                        ShellSettlementScreen(
                            draftState = draftState,
                            onDraftStateChange = { draftState = it },
                            onBack = { currentScreen = ProductScreen.TaskBoard },
                            contentPadding = innerPadding,
                        )
                    }

                    currentScreen == ProductScreen.RoundnessSurvey -> {
                        RoundnessSurveyScreen(
                            draftState = draftState,
                            onDraftStateChange = { draftState = it },
                            onBack = { currentScreen = ProductScreen.TaskBoard },
                            contentPadding = innerPadding,
                        )
                    }

                    currentScreen == ProductScreen.PlumbnessSurvey -> {
                        PlumbnessSurveyScreen(
                            draftState = draftState,
                            onDraftStateChange = { draftState = it },
                            onBack = { currentScreen = ProductScreen.TaskBoard },
                            contentPadding = innerPadding,
                        )
                    }

                    currentScreen == ProductScreen.RoofUt -> {
                        RoofUtScreen(
                            draftState = draftState,
                            onDraftStateChange = { draftState = it },
                            onOpenFindings = { nextDraftState -> openFindings(nextDraftState, ProductScreen.RoofUt) },
                            onBack = { currentScreen = ProductScreen.TaskBoard },
                            contentPadding = innerPadding,
                        )
                    }

                    currentScreen == ProductScreen.Findings -> {
                        FindingsScreen(
                            draftState = draftState,
                            onDraftStateChange = { draftState = it },
                            onBack = { currentScreen = findingsReturnScreen },
                            contentPadding = innerPadding,
                        )
                    }

                    currentScreen == ProductScreen.Review -> {
                        ReviewScreen(
                            draftState = draftState,
                            onContinueToExport = { currentScreen = ProductScreen.Export },
                            onBack = { currentScreen = ProductScreen.TaskBoard },
                            contentPadding = innerPadding,
                        )
                    }

                    currentScreen == ProductScreen.Export -> {
                        ExportScreen(
                            draftState = draftState,
                            appSessionStore = appSessionStore,
                            onBack = { currentScreen = ProductScreen.Review },
                            contentPadding = innerPadding,
                        )
                    }

                    currentScreen == ProductScreen.ShellNozzleUt -> {
                        ShellNozzleUtScreen(
                            draftState = draftState,
                            onDraftStateChange = { draftState = it },
                            onOpenFindings = { nextDraftState -> openFindings(nextDraftState, ProductScreen.ShellNozzleUt) },
                            onBack = { currentScreen = ProductScreen.TaskBoard },
                            contentPadding = innerPadding,
                        )
                    }

                    currentScreen == ProductScreen.RoofNozzleUt -> {
                        RoofNozzleUtScreen(
                            draftState = draftState,
                            onDraftStateChange = { draftState = it },
                            onOpenFindings = { nextDraftState -> openFindings(nextDraftState, ProductScreen.RoofNozzleUt) },
                            onBack = { currentScreen = ProductScreen.TaskBoard },
                            contentPadding = innerPadding,
                        )
                    }

                    currentScreen == ProductScreen.MflImport -> {
                        MflImportScreen(
                            draftState = draftState,
                            onDraftStateChange = { draftState = it },
                            onBack = { currentScreen = ProductScreen.TaskBoard },
                            contentPadding = innerPadding,
                        )
                    }

                }
            }
        }
    }
}
