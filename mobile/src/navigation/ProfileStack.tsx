import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Profile from '../screens/Profile';
import History from '../screens/History';
import SessionDetail from '../screens/SessionDetail';
import Upgrade from '../screens/Upgrade';

export type ProfileStackParamList = {
  ProfileHome: undefined;
  History: undefined;
  SessionDetail: { id: string };
  Upgrade: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={Profile} />
      <Stack.Screen name="History" component={History} />
      <Stack.Screen name="SessionDetail" component={SessionDetail} />
      <Stack.Screen name="Upgrade" component={Upgrade} />
    </Stack.Navigator>
  );
}
