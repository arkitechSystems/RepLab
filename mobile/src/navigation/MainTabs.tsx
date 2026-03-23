import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '../theme';
import TabBarIcon from '../components/TabBarIcon';
import WorkoutsStack from './WorkoutsStack';
import CalendarStack from './CalendarStack';
import UtilitiesStack from './UtilitiesStack';
import ProfileStack from './ProfileStack';

export type MainTabsParamList = {
  Workouts: undefined;
  Calendar: undefined;
  Utilities: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabsParamList>();

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(17,17,17,0.9)',
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 0.5,
          height: 85,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.wfRed,
        tabBarInactiveTintColor: colors.gray[400],
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="Workouts"
        component={WorkoutsStack}
        options={{
          tabBarLabel: 'Workouts',
          tabBarIcon: ({ focused, color, size }) => (
            <TabBarIcon name="workouts" focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarStack}
        options={{
          tabBarLabel: 'Calendar',
          tabBarIcon: ({ focused, color, size }) => (
            <TabBarIcon name="calendar" focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Utilities"
        component={UtilitiesStack}
        options={{
          tabBarLabel: 'Utilities',
          tabBarIcon: ({ focused, color, size }) => (
            <TabBarIcon name="utilities" focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused, color, size }) => (
            <TabBarIcon name="profile" focused={focused} color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
