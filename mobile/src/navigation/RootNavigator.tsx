import React, { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '../context/AuthContext';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';

export default function RootNavigator() {
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

  if (loading) {
    // Native splash screen is still visible; render nothing
    return null;
  }

  return isAuthenticated ? <MainTabs /> : <AuthStack />;
}
