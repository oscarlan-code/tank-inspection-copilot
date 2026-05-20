// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "FieldIOSDemo",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "FieldIOSDemoCore",
            targets: ["FieldIOSDemoCore"]
        ),
    ],
    targets: [
        .target(
            name: "FieldIOSDemoCore",
            resources: [
                .process("Resources"),
            ]
        ),
        .testTarget(
            name: "FieldIOSDemoCoreTests",
            dependencies: ["FieldIOSDemoCore"]
        ),
    ]
)
