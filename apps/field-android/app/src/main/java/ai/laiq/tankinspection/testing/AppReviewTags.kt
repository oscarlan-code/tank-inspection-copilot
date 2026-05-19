package ai.laiq.tankinspection.testing

object AppReviewTags {
    object Setup {
        const val Root = "setup_root"
        const val LoadSampleData = "setup_load_sample_data"
        const val StartNewInspection = "setup_start_new_inspection"
        const val SavedInspections = "setup_saved_inspections"
        const val OpenCurrentInspection = "setup_open_current_inspection"
        const val ContinueToScope = "setup_continue_to_scope"
    }

    object Scope {
        const val Root = "scope_root"
        const val Continue = "scope_continue"
    }

    object TaskBoard {
        const val Root = "task_board_root"
        const val OpenShellUt = "task_board_open_shell_ut"
    }

    object ShellUt {
        const val Root = "shell_ut_root"
        const val RecommendedCount = "shell_ut_recommended_count"
        const val LaneCount = "shell_ut_lane_count"
        const val SavedRowCount = "shell_ut_saved_row_count"
    }
}
