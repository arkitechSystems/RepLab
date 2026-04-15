import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId,
  });
  const token = tokenData.data;

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return token;
}

export async function sendTokenToServer(pushToken: string): Promise<void> {
  try {
    await api('/push/register', {
      method: 'POST',
      body: JSON.stringify({
        pushToken,
        platform: Platform.OS,
      }),
    });
  } catch (err) {
    console.warn('Failed to register push token:', err);
  }
}

export async function unregisterPushToken(pushToken: string): Promise<void> {
  try {
    await api('/push/unregister', {
      method: 'DELETE',
      body: JSON.stringify({ pushToken }),
    });
  } catch (err) {
    console.warn('Failed to unregister push token:', err);
  }
}
