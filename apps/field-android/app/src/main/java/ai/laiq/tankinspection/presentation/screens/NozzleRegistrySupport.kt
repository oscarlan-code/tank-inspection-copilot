package ai.laiq.tankinspection.presentation.screens

import ai.laiq.tankinspection.domain.model.NozzleSizeUnit

const val customNozzleSizeOptionValue = "__other__"

private val inchNozzleSizes = listOf(
    "2\"",
    "3\"",
    "4\"",
    "6\"",
    "8\"",
    "10\"",
    "12\"",
    "14\"",
    "16\"",
    "18\"",
    "20\"",
    "24\"",
    "30\"",
    "36\"",
)

private val millimeterNozzleSizes = listOf(
    "50 mm",
    "80 mm",
    "100 mm",
    "150 mm",
    "200 mm",
    "250 mm",
    "300 mm",
    "350 mm",
    "400 mm",
    "450 mm",
    "500 mm",
    "600 mm",
    "750 mm",
    "900 mm",
)

fun nozzleSizeOptions(unit: NozzleSizeUnit): List<Pair<String, String>> {
    val presetValues = when (unit) {
        NozzleSizeUnit.INCH -> inchNozzleSizes
        NozzleSizeUnit.MM -> millimeterNozzleSizes
        NozzleSizeUnit.MIXED_TEXT -> inchNozzleSizes
    }
    return buildList {
        add("" to "Select Size")
        addAll(presetValues.map { size -> size to size })
        add(customNozzleSizeOptionValue to "Other")
    }
}

fun selectedNozzleSizeOption(
    rawSize: String,
    unit: NozzleSizeUnit,
): String {
    if (rawSize.isBlank()) return ""
    val presetValues = nozzleSizeOptions(unit).map { option -> option.first }.toSet()
    return if (presetValues.contains(rawSize)) rawSize else customNozzleSizeOptionValue
}

fun applyNozzleSizeSelection(
    currentSize: String,
    selectedOption: String,
    unit: NozzleSizeUnit,
): String = when (selectedOption) {
    "" -> ""
    customNozzleSizeOptionValue -> {
        val presetValues = nozzleSizeOptions(unit).map { option -> option.first }.toSet()
        if (presetValues.contains(currentSize)) "" else currentSize
    }
    else -> selectedOption
}
