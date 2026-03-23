import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Calendar from '../screens/Calendar';
import WorkoutSession from '../screens/WorkoutSession';
import History from '../screens/History';
import SessionDetail from '../screens/SessionDetail';

export type CalendarStackParamList = {
  CalendarHome: undefined;
  WorkoutSession: { templateId: string; date: string };
  History: undefined;
  SessionDetail: { id: string };
};

const Stack = createNativeStackNavigator<CalendarStackParamList>();

export default function CalendarStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CalendarHome" component={Calendar} />
      <Stack.Screen name="WorkoutSession" component={WorkoutSession} />
      <Stack.Screen name="History" component={History} />
      <Stack.Screen name="SessionDetail" component={SessionDetail} />
    </Stack.Navigator>
  );
}
