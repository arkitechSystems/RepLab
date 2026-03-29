import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, ScrollView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { api } from '../api';
import type { AuthStackParamList } from '../navigation/AuthStack';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'ResetPassword'>;
type Route = RouteProp<AuthStackParamList, 'ResetPassword'>;

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { token } = route.params;

  async function handleSubmit() {
    setError('');

    const pe: string[] = [];
    if (password.length < 8) pe.push('at least 8 characters');
    if (!/[A-Z]/.test(password)) pe.push('at least 1 uppercase letter');
    if (!/[0-9]/.test(password)) pe.push('at least 1 number');
    if (/\s/.test(password)) pe.push('no spaces');
    if (pe.length > 0) {
      setError('Password must have: ' + pe.join(', '));
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>
              REP<Text style={styles.logoAccent}>LAB</Text>
            </Text>
            <Text style={styles.subtitle}>Set a new password</Text>
          </View>

          {success ? (
            <View style={styles.successCard}>
              <View style={styles.checkCircle}>
                <Text style={styles.checkMark}>✓</Text>
              </View>
              <Text style={styles.successTitle}>Password updated</Text>
              <Text style={styles.successBody}>
                Your password has been reset. You can now sign in.
              </Text>
              <Pressable onPress={() => navigation.navigate('Login')}>
                <LinearGradient
                  colors={['#EF4444', '#DC2626']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.signInButton}
                >
                  <Text style={styles.buttonText}>Sign In</Text>
                </LinearGradient>
              </Pressable>
            </View>
          ) : (
            <>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>NEW PASSWORD</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter new password"
                  placeholderTextColor="#555555"
                  secureTextEntry
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>CONFIRM PASSWORD</Text>
                <TextInput
                  style={styles.input}
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Confirm new password"
                  placeholderTextColor="#555555"
                  secureTextEntry
                />
              </View>

              <Pressable onPress={handleSubmit} disabled={loading}>
                <LinearGradient
                  colors={['#EF4444', '#DC2626']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.button, loading && styles.buttonDisabled]}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Reset Password</Text>
                  )}
                </LinearGradient>
              </Pressable>

              <View style={styles.switchRow}>
                <Pressable onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.switchLink}>Back to Sign In</Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 36, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2 },
  logoAccent: { color: '#EF4444' },
  subtitle: { color: '#888888', fontSize: 14, marginTop: 8 },
  successCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  checkMark: { color: '#4ADE80', fontSize: 28, fontWeight: 'bold' },
  successTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  successBody: { color: '#888888', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  signInButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  errorBox: {
    backgroundColor: 'rgba(127, 29, 29, 0.3)',
    borderWidth: 1,
    borderColor: '#991B1B',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  errorText: { color: '#FCA5A5', fontSize: 14 },
  fieldGroup: { marginBottom: 16 },
  label: { color: '#888888', fontSize: 11, letterSpacing: 1, marginBottom: 6 },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 16,
  },
  button: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  switchRow: { alignItems: 'center', marginTop: 16 },
  switchLink: { color: '#EF4444', fontSize: 14, fontWeight: '500' },
});
