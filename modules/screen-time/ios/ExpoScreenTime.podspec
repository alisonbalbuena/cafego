Pod::Spec.new do |s|
  s.name           = 'ExpoScreenTime'
  s.version        = '1.0.0'
  s.summary        = 'FamilyControls-based screen time shielding for study sessions'
  s.description    = 'Requests Screen Time (FamilyControls) authorization, lets the user pick distracting apps, and shields/unshields them around study sessions.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
