package ai.laiq.tankinspection.prototype.layoutdrawing

class MockLayoutRecognitionEngine : LayoutRecognitionEngine {
    override fun recognize(input: PrototypeRecognitionInput): PrototypeLayoutDraft =
        when (input.sourceType) {
            PrototypeLayoutSourceType.V3_BASE ->
                PrototypeLayoutGeometry.generateV3BaseDraft(
                    surface = input.surface,
                    grid = input.grid,
                )
            PrototypeLayoutSourceType.SKETCH,
            PrototypeLayoutSourceType.IMAGE_IMPORT ->
                PrototypeLayoutGeometry.draftFromSketch(input)
        }
}
