import SwiftUI
import FamilyControls

/// Result of presenting the system `FamilyActivityPicker` modally.
enum ActivityPickerResult {
  case saved(FamilyActivitySelection)
  case cancelled
}

/// Thin wrapper around Apple's `FamilyActivityPicker` (a SwiftUI-only view —
/// there's no UIKit equivalent) with a Cancel/Done toolbar, so it can be
/// presented from a plain UIKit/Expo Modules AsyncFunction via
/// `UIHostingController` instead of needing the full Expo Modules "View"
/// wrapper machinery.
struct ActivityPickerContainerView: View {
  @State private var selection: FamilyActivitySelection
  let onFinish: (ActivityPickerResult) -> Void

  init(selection: FamilyActivitySelection?, onFinish: @escaping (ActivityPickerResult) -> Void) {
    _selection = State(initialValue: selection ?? FamilyActivitySelection())
    self.onFinish = onFinish
  }

  var body: some View {
    NavigationView {
      FamilyActivityPicker(selection: $selection)
        .navigationTitle("Distracting Apps")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) {
            Button("Cancel") { onFinish(.cancelled) }
          }
          ToolbarItem(placement: .confirmationAction) {
            Button("Done") { onFinish(.saved(selection)) }
          }
        }
    }
    .navigationViewStyle(.stack)
  }
}
