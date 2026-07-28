import ActivityKit
import ExpoModulesCore

public class ExpoStudyTimerActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoStudyTimerActivity")

    Function("isSupported") { () -> Bool in
      ActivityAuthorizationInfo().areActivitiesEnabled
    }

    AsyncFunction("startActivity") {
      (
        cafeName: String,
        subject: String,
        phaseLabel: String,
        phaseEndDateMs: Double,
        remainingSeconds: Int,
        paused: Bool,
        promise: Promise
      ) in
      guard ActivityAuthorizationInfo().areActivitiesEnabled else {
        promise.resolve(false)
        return
      }

      // Only one study-session Live Activity should ever be running.
      Task {
        for activity in Activity<StudyTimerWidgetAttributes>.activities {
          await activity.end(nil, dismissalPolicy: .immediate)
        }

        let attributes = StudyTimerWidgetAttributes(cafeName: cafeName)
        let state = StudyTimerWidgetAttributes.ContentState(
          phaseLabel: phaseLabel,
          phaseEndDate: Date(timeIntervalSince1970: phaseEndDateMs / 1000),
          remainingSeconds: remainingSeconds,
          paused: paused,
          subject: subject
        )

        do {
          _ = try Activity<StudyTimerWidgetAttributes>.request(
            attributes: attributes,
            content: .init(state: state, staleDate: nil)
          )
          promise.resolve(true)
        } catch {
          promise.reject("ERR_LIVE_ACTIVITY", error.localizedDescription)
        }
      }
    }

    AsyncFunction("updateActivity") {
      (
        subject: String,
        phaseLabel: String,
        phaseEndDateMs: Double,
        remainingSeconds: Int,
        paused: Bool,
        promise: Promise
      ) in
      Task {
        let state = StudyTimerWidgetAttributes.ContentState(
          phaseLabel: phaseLabel,
          phaseEndDate: Date(timeIntervalSince1970: phaseEndDateMs / 1000),
          remainingSeconds: remainingSeconds,
          paused: paused,
          subject: subject
        )
        for activity in Activity<StudyTimerWidgetAttributes>.activities {
          await activity.update(.init(state: state, staleDate: nil))
        }
        promise.resolve(nil)
      }
    }

    AsyncFunction("endActivity") { (promise: Promise) in
      Task {
        for activity in Activity<StudyTimerWidgetAttributes>.activities {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
        promise.resolve(nil)
      }
    }
  }
}
