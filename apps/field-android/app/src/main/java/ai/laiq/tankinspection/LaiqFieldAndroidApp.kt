package ai.laiq.tankinspection

import ai.laiq.tankinspection.data.local.AppSessionStore
import ai.laiq.tankinspection.presentation.components.LaiqColors
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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LaiqFieldAndroidApp() {
    val context = LocalContext.current.applicationContext
    val appSessionStore = remember(context) { AppSessionStore(context) }
    var currentScreen by remember { mutableStateOf(ProductScreen.Setup) }
    var draftState by remember { mutableStateOf(FieldDraftState()) }
    var findingsReturnScreen by remember { mutableStateOf(ProductScreen.TaskBoard) }
    var hasLoadedSession by remember { mutableStateOf(false) }
    var selectedDemoScenarioId by remember { mutableStateOf(defaultDemoInspectionScenarioId()) }
    var localInspections by remember { mutableStateOf<List<InspectionRecordEntity>>(emptyList()) }
    var inspectionListRefreshKey by remember { mutableStateOf(0) }
    var savedInspectionNotice by remember { mutableStateOf<String?>(null) }
    val demoScenarioOptions = remember { demoInspectionScenarioOptions() }
    val coroutineScope = rememberCoroutineScope()

    fun openFindings(nextDraftState: FieldDraftState, returnScreen: ProductScreen) {
        draftState = nextDraftState
        findingsReturnScreen = returnScreen
        currentScreen = ProductScreen.Findings
    }

    LaunchedEffect(appSessionStore) {
        val savedSession = appSessionStore.load()
        if (savedSession != null) {
            currentScreen = savedSession.currentScreen
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
            Scaffold(
                topBar = {
                    TopAppBar(
                        colors = TopAppBarDefaults.topAppBarColors(
                            containerColor = MaterialTheme.colorScheme.background,
                            titleContentColor = LaiqColors.BrandTeal,
                        ),
                        title = {
                            Text(
                                when (currentScreen) {
                                    ProductScreen.Setup -> "Inspection Setup"
                                    ProductScreen.Scope -> "Inspection Scope"
                                    ProductScreen.TaskBoard -> "Task Board"
                                    ProductScreen.RoofLayout -> "Roof Elements"
                                    ProductScreen.ShellUt -> "Shell UT"
                                    ProductScreen.ShellSettlement -> "Shell Settlement"
                                    ProductScreen.RoundnessSurvey -> "Roundness Survey"
                                    ProductScreen.PlumbnessSurvey -> "Plumbness Survey"
                                    ProductScreen.RoofUt -> "Roof UT"
                                    ProductScreen.ShellNozzleUt -> "Shell Nozzles"
                                    ProductScreen.RoofNozzleUt -> "Roof Nozzles"
                                    ProductScreen.Findings -> "Findings"
                                    ProductScreen.Review -> "Review"
                                    ProductScreen.Export -> "Export"
                                    ProductScreen.MflImport -> "Bottom MFL"
                                },
                            )
                        },
                    )
                },
            ) { innerPadding ->
                when (currentScreen) {
                    ProductScreen.Setup -> {
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
                                savedInspectionNotice = null
                                draftState = draftState.commitFundamentalInputs()
                                    .saveRoofLayoutDraft(ROOF_SURFACE_FIXED)
                                    .saveRoofLayoutDraft(ROOF_SURFACE_FLOATING)
                                currentScreen = ProductScreen.Scope
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
                                        currentScreen = savedInspection.currentScreen
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

                    ProductScreen.Scope -> {
                        InspectionScopeScreen(
                            state = draftState.scope,
                            onStateChange = { draftState = draftState.copy(scope = it) },
                            onBack = { currentScreen = ProductScreen.Setup },
                            onContinue = { currentScreen = ProductScreen.TaskBoard },
                            contentPadding = innerPadding,
                        )
                    }

                    ProductScreen.TaskBoard -> {
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

                    ProductScreen.RoofLayout -> {
                        RoofLayoutScreen(
                            draftState = draftState,
                            onDraftStateChange = { draftState = it },
                            onBack = { currentScreen = ProductScreen.TaskBoard },
                            contentPadding = innerPadding,
                        )
                    }

                    ProductScreen.ShellUt -> {
                        ShellUtScreen(
                            draftState = draftState,
                            onDraftStateChange = { draftState = it },
                            onOpenFindings = { nextDraftState -> openFindings(nextDraftState, ProductScreen.ShellUt) },
                            onBack = { currentScreen = ProductScreen.TaskBoard },
                            contentPadding = innerPadding,
                        )
                    }

                    ProductScreen.ShellSettlement -> {
                        ShellSettlementScreen(
                            draftState = draftState,
                            onDraftStateChange = { draftState = it },
                            onBack = { currentScreen = ProductScreen.TaskBoard },
                            contentPadding = innerPadding,
                        )
                    }

                    ProductScreen.RoundnessSurvey -> {
                        RoundnessSurveyScreen(
                            draftState = draftState,
                            onDraftStateChange = { draftState = it },
                            onBack = { currentScreen = ProductScreen.TaskBoard },
                            contentPadding = innerPadding,
                        )
                    }

                    ProductScreen.PlumbnessSurvey -> {
                        PlumbnessSurveyScreen(
                            draftState = draftState,
                            onDraftStateChange = { draftState = it },
                            onBack = { currentScreen = ProductScreen.TaskBoard },
                            contentPadding = innerPadding,
                        )
                    }

                    ProductScreen.RoofUt -> {
                        RoofUtScreen(
                            draftState = draftState,
                            onDraftStateChange = { draftState = it },
                            onOpenFindings = { nextDraftState -> openFindings(nextDraftState, ProductScreen.RoofUt) },
                            onBack = { currentScreen = ProductScreen.TaskBoard },
                            contentPadding = innerPadding,
                        )
                    }

                    ProductScreen.Findings -> {
                        FindingsScreen(
                            draftState = draftState,
                            onDraftStateChange = { draftState = it },
                            onBack = { currentScreen = findingsReturnScreen },
                            contentPadding = innerPadding,
                        )
                    }

                    ProductScreen.Review -> {
                        ReviewScreen(
                            draftState = draftState,
                            onContinueToExport = { currentScreen = ProductScreen.Export },
                            onBack = { currentScreen = ProductScreen.TaskBoard },
                            contentPadding = innerPadding,
                        )
                    }

                    ProductScreen.Export -> {
                        ExportScreen(
                            draftState = draftState,
                            appSessionStore = appSessionStore,
                            onBack = { currentScreen = ProductScreen.Review },
                            contentPadding = innerPadding,
                        )
                    }

                    ProductScreen.ShellNozzleUt -> {
                        ShellNozzleUtScreen(
                            draftState = draftState,
                            onDraftStateChange = { draftState = it },
                            onOpenFindings = { nextDraftState -> openFindings(nextDraftState, ProductScreen.ShellNozzleUt) },
                            onBack = { currentScreen = ProductScreen.TaskBoard },
                            contentPadding = innerPadding,
                        )
                    }

                    ProductScreen.RoofNozzleUt -> {
                        RoofNozzleUtScreen(
                            draftState = draftState,
                            onDraftStateChange = { draftState = it },
                            onOpenFindings = { nextDraftState -> openFindings(nextDraftState, ProductScreen.RoofNozzleUt) },
                            onBack = { currentScreen = ProductScreen.TaskBoard },
                            contentPadding = innerPadding,
                        )
                    }

                    ProductScreen.MflImport -> {
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
