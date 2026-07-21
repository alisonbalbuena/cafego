import { Alert, Platform } from 'react-native';

export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    // react-native-web's Alert.alert() is a no-op, so fall back to the browser's own alert.
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function showConfirm(
  title: string,
  message: string,
  confirmLabel = 'Confirm'
): Promise<boolean> {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      resolve(window.confirm(`${title}\n\n${message}`));
      return;
    }
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
