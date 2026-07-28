Pod::Spec.new do |s|
  s.name           = 'ExpoStudyTimerActivity'
  s.version        = '1.0.0'
  s.summary        = 'Live Activity (Lock Screen / Dynamic Island) countdown for study sessions'
  s.description    = 'Starts, updates, and ends an ActivityKit Live Activity showing the current study session phase and countdown.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
