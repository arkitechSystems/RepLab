import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Workouts from '../screens/Workouts';
import CreateWorkout from '../screens/CreateWorkout';
import EditWorkout from '../screens/EditWorkout';
import CreateProgram from '../screens/CreateProgram';
import WorkoutSession from '../screens/WorkoutSession';

export type WorkoutsStackParamList = {
  WorkoutsHome: undefined;
  CreateWorkout: { programId?: number; quick?: boolean };
  EditWorkout: { id: number };
  CreateProgram: undefined;
  WorkoutSession: { templateId: string; date: string };
};

const Stack = createNativeStackNavigator<WorkoutsStackParamList>();

export default function WorkoutsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WorkoutsHome" component={Workouts} />
      <Stack.Screen name="CreateWorkout" component={CreateWorkout} />
      <Stack.Screen name="EditWorkout" component={EditWorkout} />
      <Stack.Screen name="CreateProgram" component={CreateProgram} />
      <Stack.Screen name="WorkoutSession" component={WorkoutSession} />
    </Stack.Navigator>
  );
}
