import ActivityKit
import Foundation

/// Mirrors ios/StudyTimerWidget/StudyTimerActivityAttributes.swift exactly.
/// ActivityKit bridges attributes/state across the app <-> widget-extension
/// process boundary via Codable, so this doesn't need to be the literal same
/// compiled type — it needs to produce the same Codable representation. Two
/// separate targets (this pod, and the widget extension) can't share a
/// single Swift source file without Swift Package Manager, so it's kept in
/// sync by hand between the two locations instead.
struct StudyTimerWidgetAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var phaseLabel: String
        var phaseEndDate: Date
        var remainingSeconds: Int
        var paused: Bool
        var subject: String
    }

    var cafeName: String
}
