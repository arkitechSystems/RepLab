import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

const PLANS = [
  {
    name: 'Pro',
    color: '#3B82F6',
    price: '$9.99/mo',
    features: [
      'Featured trainer workouts',
      'AI workout generator',
      'Advanced analytics',
      'Priority support',
    ],
  },
  {
    name: 'Elite',
    color: '#A855F7',
    price: '$19.99/mo',
    features: [
      'Everything in Pro',
      'Custom program builder',
      'Video exercise guides',
      'Nutrition tracking',
      '1-on-1 trainer chat',
    ],
  },
];

export default function Upgrade() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>⏳</Text>
        </View>

        <Text style={styles.title}>Paid Plans Coming Soon</Text>
        <Text style={styles.subtitle}>
          We're building Pro and Elite plans with premium features.
          Stay tuned — upgrades will be available shortly.
        </Text>

        <View style={styles.plans}>
          {PLANS.map((plan) => (
            <View
              key={plan.name}
              style={[styles.planCard, { borderColor: plan.color }]}
            >
              <View style={styles.planHeader}>
                <Text style={[styles.planName, { color: plan.color }]}>
                  {plan.name}
                </Text>
                <Text style={styles.planPrice}>{plan.price}</Text>
              </View>

              <View style={styles.features}>
                {plan.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Text style={[styles.checkIcon, { color: plan.color }]}>✓</Text>
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        <Pressable onPress={() => navigation.goBack()}>
          <LinearGradient
            colors={['#3B82F6', '#A855F7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 20,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconText: { fontSize: 32 },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  plans: { width: '100%', gap: 14 },
  planCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planName: { fontSize: 18, fontWeight: 'bold' },
  planPrice: { color: '#AAAAAA', fontSize: 14, fontWeight: '600' },
  features: { gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkIcon: { fontSize: 14, fontWeight: 'bold' },
  featureText: { color: '#CCCCCC', fontSize: 14 },
  backButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  backButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
});
