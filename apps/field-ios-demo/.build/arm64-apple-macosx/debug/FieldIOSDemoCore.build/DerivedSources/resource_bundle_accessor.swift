import Foundation

extension Foundation.Bundle {
    static let module: Bundle = {
        let mainPath = Bundle.main.bundleURL.appendingPathComponent("FieldIOSDemo_FieldIOSDemoCore.bundle").path
        let buildPath = "/Users/oscar/Documents/oscar-code/tank-inspection-coplilot-app/apps/field-ios-demo/.build/arm64-apple-macosx/debug/FieldIOSDemo_FieldIOSDemoCore.bundle"

        let preferredBundle = Bundle(path: mainPath)

        guard let bundle = preferredBundle ?? Bundle(path: buildPath) else {
            // Users can write a function called fatalError themselves, we should be resilient against that.
            Swift.fatalError("could not load resource bundle: from \(mainPath) or \(buildPath)")
        }

        return bundle
    }()
}