import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

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

export default function FreeTrialOffer() {
  const [selectedPlan, setSelectedPlan] = useState('Pro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigation = useNavigation();
  const { updateUser } = useAuth();

  async function handleStartTrial() {
    setLoading(true);
    setError('');
    try {
      const data = await api('/auth/start-trial', {
        method: 'POST',
        body: JSON.stringify({ plan: selectedPlan }),
      });
      updateUser(data.user);
      // Auth state change triggers RootNavigator to show MainTabs
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    // User is already authenticated, RootNavigator will show MainTabs
    // Reset the navigation stack so they can't go back to onboarding
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'Login' as never }] })
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <LinearGradient
            colors={['#EAB308', '#F97316']}
            style={styles.starCircle}
          >
            <Text style={styles.starIcon}>✦</Text>
          </LinearGradient>
          <Text style={styles.title}>Try Premium Free</Text>
          <Text style={styles.subtitle}>
            Get 7 days free — no credit card required. Cancel anytime.
          </Text>
        </View>

        {/* Plan Cards */}
        <View style={styles.plans}>
          {PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.name;
            return (
              <Pressable
                key={plan.name}
                onPress={() => setSelectedPlan(plan.name)}
                style={[
                  styles.planCard,
                  {
                    borderColor: isSelected ? plan.color : 'rgba(255,255,255,0.1)',
                    backgroundColor: isSelected ? `${plan.color}10` : 'rgba(255,255,255,0.05)',
                  },
                ]}
              >
                <View style={styles.planHeader}>
                  <View style={styles.planNameRow}>
                    <Text style={[styles.planName, isSelected && { color: plan.color }]}>
                      {plan.name}
                    </Text>
                    {plan.name === 'Elite' && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>BEST VALUE</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.planPricing}>
                    <Text style={styles.oldPrice}>{plan.price}</Text>
                    <Text style={[styles.freeText, isSelected && { color: plan.color }]}>
                      Free for 7 days
                    </Text>
                  </View>
                </View>

                <View style={styles.features}>
                  {plan.features.map((f) => (
                    <View key={f} style={styles.featureRow}>
                      <Text style={[styles.checkIcon, isSelected && { color: plan.color }]}>✓</Text>
                      <Text style={styles.featureText}>{f}</Text>
                    </View>
                  ))}
                </View>

                {/* Radio */}
                <View style={styles.radioRow}>
                  <View style={[styles.radio, { borderColor: isSelected ? plan.color : 'rgba(255,255,255,0.2)' }]}>
                    {isSelected && (
                      <View style={[styles.radioDot, { backgroundColor: plan.color }]} />
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* CTA */}
        <Pressable onPress={handleStartTrial} disabled={loading}>
          <LinearGradient
            colors={['#EAB308', '#F97316']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.ctaButton, loading && styles.ctaDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.ctaText}>Start Free {selectedPlan} Trial</Text>
            )}
          </LinearGradient>
        </Pressable>

        <Text style={styles.disclaimer}>
          Your 7-day free trial begins immediately. You won't be charged during the trial period.
        </Text>

        <Pressable onPress={handleSkip}>
          <Text style={styles.skipText}>No thanks, continue with Free</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 20,
  },
  header: { alignItems: 'center' },
  starCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  starIcon: { fontSize: 28, color: '#000000' },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginBottom: 8 },
  subtitle: { color: '#888888', fontSize: 14, textAlign: 'center' },
  plans: { width: '100%', gap: 12 },
  planCard: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  planNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planName: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF' },
  badge: {
    backgroundColor: 'rgba(168,85,247,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: { color: '#C084FC', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
  planPricing: { alignItems: 'flex-end' },
  oldPrice: { color: '#555555', fontSize: 12, textDecorationLine: 'line-through' },
  freeText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
  features: { gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkIcon: { color: '#555555', fontSize: 14, fontWeight: 'bold' },
  featureText: { color: '#888888', fontSize: 14 },
  radioRow: { alignItems: 'flex-end', marginTop: 12 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  errorText: { color: '#F87171', fontSize: 14, textAlign: 'center' },
  ctaButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: '#000000', fontSize: 16, fontWeight: 'bold' },
  disclaimer: {
    color: '#555555',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  skipText: { color: '#555555', fontSize: 14 },
});
