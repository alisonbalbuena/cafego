import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/hooks/useAuth';
import RootNavigator from './src/navigation/RootNavigator';
import DismissKeyboardView from './src/components/DismissKeyboardView';

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <DismissKeyboardView>
        <RootNavigator />
      </DismissKeyboardView>
    </AuthProvider>
  );
}
