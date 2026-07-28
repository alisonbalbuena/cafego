import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { AuthProvider } from './src/hooks/useAuth';
import RootNavigator from './src/navigation/RootNavigator';
import DismissKeyboardView from './src/components/DismissKeyboardView';

export default function App() {
  const [fontsLoaded] = useFonts({
    Monocraft: require('./assets/fonts/Monocraft.ttf'),
    'Monocraft-SemiBold': require('./assets/fonts/Monocraft-SemiBold.ttf'),
    'Monocraft-Bold': require('./assets/fonts/Monocraft-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#2a1810' }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="auto" />
        <DismissKeyboardView>
          <RootNavigator />
        </DismissKeyboardView>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
