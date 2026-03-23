import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/AuthStack';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;

const TOUR_STEPS = [
  {
    icon: '💪',
    title: 'Browse Workouts',
    description: 'Explore pre-built programs like Push Pull Legs, Bro Split, and more — or create your own custom workouts from scratch.',
  },
  {
    icon: '📅',
    title: 'Schedule Your Week',
    description: 'Assign workouts to each day of the week on the Calendar tab. Tap a day to set your routine and stay consistent.',
  },
  {
    icon: '🏆',
    title: 'Track & Beat PRs',
    description: 'Log your sets, reps, and weight during each session. The app automatically tracks your personal bests so you can see your progress.',
  },
  {
    icon: '🔧',
    title: 'Utilities & Tools',
    description: 'Use built-in tools like the 1 Rep Max Estimator to calculate your strength. More tools coming soon!',
  },
];

export default function Welcome() {
  const [step, setStep] = useState(-1);
  const navigation = useNavigation<Nav>();

  function handleNext() {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      navigation.navigate('FreeTrialOffer');
    }
  }

  function handleSkip() {
    navigation.navigate('FreeTrialOffer');
  }

  // Intro screen
  if (step === -1) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.introContent}>
          <Text style={styles.logo}>
            WILL<Text style={styles.logoAccent}>FIT</Text>
          </Text>
          <Text style={styles.introSub}>Welcome! Get to know the app.</Text>

          <Pressable onPress={() => setStep(0)} style={styles.fullWidth}>
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Take a Tour</Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={handleSkip}>
            <Text style={styles.skipText}>skip</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Tour steps
  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip */}
      <View style={styles.skipRow}>
        <Pressable onPress={handleSkip}>
          <Text style={styles.skipText}>skip</Text>
        </Pressable>
      </View>

      {/* Content */}
      <View style={styles.tourContent}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconEmoji}>{current.icon}</Text>
        </View>
        <Text style={styles.tourTitle}>{current.title}</Text>
        <Text style={styles.tourDescription}>{current.description}</Text>
      </View>

      {/* Bottom: dots + button */}
      <View style={styles.bottomSection}>
        <View style={styles.dotsRow}>
          {TOUR_STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === step && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <Pressable onPress={handleNext} style={styles.fullWidth}>
          <LinearGradient
            colors={['#EF4444', '#DC2626']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.button}
          >
            <Text style={styles.buttonText}>{isLast ? "Let's Go" : 'Next'}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 24,
  },
  // Intro
  introContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  logo: { fontSize: 36, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2 },
  logoAccent: { color: '#EF4444' },
  introSub: { color: '#888888', fontSize: 16 },
  fullWidth: { width: '100%' },
  button: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  skipText: { color: '#555555', fontSize: 14 },
  // Tour
  skipRow: { alignItems: 'flex-end', paddingTop: 12 },
  tourContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  iconCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconEmoji: { fontSize: 48 },
  tourTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  tourDescription: {
    color: '#888888',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  // Bottom
  bottomSection: {
    alignItems: 'center',
    gap: 24,
    paddingBottom: 24,
  },
  dotsRow: { flexDirection: 'row', gap: 8 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#EF4444',
  },
});
