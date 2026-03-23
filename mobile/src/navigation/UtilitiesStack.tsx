import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Utilities from '../screens/Utilities';

export type UtilitiesStackParamList = {
  UtilitiesHome: undefined;
};

const Stack = createNativeStackNavigator<UtilitiesStackParamList>();

export default function UtilitiesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="UtilitiesHome" component={Utilities} />
    </Stack.Navigator>
  );
}
