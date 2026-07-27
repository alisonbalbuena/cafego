import ExpoModulesCore
import FamilyControls
import ManagedSettings
import SwiftUI
import UIKit

/// A named store (rather than the default unnamed one) so this feature's
/// restrictions never collide with any other Screen Time configuration on
/// the device.
private let studySessionStoreName = ManagedSettingsStore.Name("com.focusbrew.cafestudyapp.studySession")
private let selectionDefaultsKey = "ExpoScreenTime.familyActivitySelection"

public class ExpoScreenTimeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoScreenTime")

    // MARK: Authorization

    AsyncFunction("requestAuthorization") { (promise: Promise) in
      Task {
        do {
          try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
          promise.resolve(true)
        } catch {
          promise.reject("ERR_AUTHORIZATION", error.localizedDescription)
        }
      }
    }

    Function("getAuthorizationStatus") { () -> String in
      switch AuthorizationCenter.shared.authorizationStatus {
      case .notDetermined:
        return "notDetermined"
      case .denied:
        return "denied"
      case .approved:
        return "approved"
      @unknown default:
        return "unknown"
      }
    }

    // MARK: Picking which apps to shield
    //
    // Apple never lets the host app learn *which* specific apps/categories
    // were picked — FamilyActivitySelection only exposes opaque tokens. We
    // keep the whole selection on the native side (UserDefaults) and only
    // ever tell JS whether a selection exists, never what's in it.

    AsyncFunction("presentActivityPicker") { (promise: Promise) in
      DispatchQueue.main.async {
        guard
          let rootVC = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first?.windows.first(where: { $0.isKeyWindow })?.rootViewController
        else {
          promise.reject("ERR_NO_ROOT_VC", "Could not find a root view controller to present from.")
          return
        }

        let existingSelection = ExpoScreenTimeModule.loadSelection()
        let pickerView = ActivityPickerContainerView(selection: existingSelection) { result in
          rootVC.dismiss(animated: true)
          switch result {
          case .saved(let selection):
            ExpoScreenTimeModule.saveSelection(selection)
            promise.resolve(true)
          case .cancelled:
            promise.resolve(false)
          }
        }
        let hosting = UIHostingController(rootView: pickerView)
        hosting.modalPresentationStyle = .formSheet
        rootVC.present(hosting, animated: true)
      }
    }

    Function("hasSelection") { () -> Bool in
      ExpoScreenTimeModule.loadSelection() != nil
    }

    // MARK: Applying / removing the shield

    AsyncFunction("applyShield") { (promise: Promise) in
      guard let selection = ExpoScreenTimeModule.loadSelection() else {
        promise.reject("ERR_NO_SELECTION", "No apps have been selected to shield yet — call presentActivityPicker() first.")
        return
      }
      let store = ManagedSettingsStore(named: studySessionStoreName)
      store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
      store.shield.applicationCategories = selection.categoryTokens.isEmpty
        ? nil
        : .specific(selection.categoryTokens)
      store.shield.webDomains = selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
      promise.resolve(nil)
    }

    AsyncFunction("removeShield") { (promise: Promise) in
      let store = ManagedSettingsStore(named: studySessionStoreName)
      store.shield.applications = nil
      store.shield.applicationCategories = nil
      store.shield.webDomains = nil
      promise.resolve(nil)
    }
  }

  static func loadSelection() -> FamilyActivitySelection? {
    guard let data = UserDefaults.standard.data(forKey: selectionDefaultsKey) else { return nil }
    return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
  }

  static func saveSelection(_ selection: FamilyActivitySelection) {
    guard let data = try? JSONEncoder().encode(selection) else { return }
    UserDefaults.standard.set(data, forKey: selectionDefaultsKey)
  }
}
