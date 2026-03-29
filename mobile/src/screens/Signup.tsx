import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, ScrollView, Platform, ActivityIndicator,
  Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import type { AuthStackParamList } from '../navigation/AuthStack';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Signup'>;

function isPhone(value: string) {
  return /^\+?\d[\d\s\-().]{6,}$/.test(value.trim());
}

const REFERRAL_OPTIONS = [
  { value: '', label: 'Select one...' },
  { value: 'facebook', label: 'Facebook / Instagram Ad' },
  { value: 'youtube', label: 'YouTube Ad' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'google', label: 'Google Search' },
  { value: 'friend', label: 'Friend / Word of Mouth' },
  { value: 'other', label: 'Other' },
];

export default function Signup() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [username, setUsername] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [referralOther, setReferralOther] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const { signup } = useAuth();
  const navigation = useNavigation<Nav>();

  const isPhoneIdentifier = isPhone(identifier);

  async function handleSubmit() {
    setError('');

    const pwErrors: string[] = [];
    if (password.length < 8) pwErrors.push('at least 8 characters');
    if (!/[A-Z]/.test(password)) pwErrors.push('at least 1 uppercase letter');
    if (!/[0-9]/.test(password)) pwErrors.push('at least 1 number');
    if (/\s/.test(password)) pwErrors.push('no spaces');
    if (pwErrors.length > 0) {
      setError('Password must have: ' + pwErrors.join(', '));
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }
    if (!lastName.trim()) {
      setError('Last name is required');
      return;
    }
    if (!zipCode.trim()) {
      setError('Zip code is required');
      return;
    }

    setLoading(true);
    try {
      const finalReferral = referralSource === 'other' ? `Other: ${referralOther}`
        : referralSource === 'friend' && referralOther.trim() ? `Friend: ${referralOther.trim()}`
        : referralSource;

      await signup(identifier, password, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        gender: gender || undefined,
        username: username.trim() || undefined,
        referralSource: finalReferral || undefined,
        referralCode: referralCode.trim() || undefined,
        zipCode: zipCode.trim() || undefined,
        deviceInfo: { platform: Platform.OS },
      });

      navigation.navigate('Welcome');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const selectedLabel = REFERRAL_OPTIONS.find(o => o.value === referralSource)?.label || 'Select one...';

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
          {/* Back */}
          <Pressable onPress={() => navigation.navigate('Login')} style={styles.backRow}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>

          {/* Logo */}
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>
              REP<Text style={styles.logoAccent}>LAB</Text>
            </Text>
            <Text style={styles.subtitle}>Create your account</Text>
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Email/Phone */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>EMAIL OR PHONE</Text>
            <TextInput
              style={styles.input}
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="Email or phone number"
              placeholderTextColor="#555555"
              keyboardType={isPhoneIdentifier ? 'phone-pad' : 'email-address'}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Create password"
              placeholderTextColor="#555555"
              secureTextEntry
            />
          </View>

          {/* Confirm Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>CONFIRM PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Confirm password"
              placeholderTextColor="#555555"
              secureTextEntry
            />
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ABOUT YOU</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Name Row */}
          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <Text style={styles.label}>FIRST NAME *</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor="#555555"
              />
            </View>
            <View style={styles.nameField}>
              <Text style={styles.label}>LAST NAME *</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor="#555555"
              />
            </View>
          </View>

          {/* Phone (if email signup) */}
          {!isPhoneIdentifier && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>PHONE NUMBER <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="(555) 123-4567"
                placeholderTextColor="#555555"
                keyboardType="phone-pad"
              />
            </View>
          )}

          {/* Zip Code */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>ZIP CODE *</Text>
            <TextInput
              style={styles.input}
              value={zipCode}
              onChangeText={setZipCode}
              placeholder="e.g. 02101"
              placeholderTextColor="#555555"
              keyboardType="number-pad"
              maxLength={10}
            />
          </View>

          {/* Gender */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>GENDER <Text style={styles.optional}>(optional)</Text></Text>
            <View style={styles.genderRow}>
              {['Male', 'Female', 'Other'].map((g) => (
                <Pressable
                  key={g}
                  onPress={() => setGender(gender === g ? '' : g)}
                  style={[
                    styles.genderButton,
                    gender === g && styles.genderButtonActive,
                  ]}
                >
                  <Text style={[
                    styles.genderText,
                    gender === g && styles.genderTextActive,
                  ]}>
                    {g}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Username */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>USERNAME <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Auto-generated if left blank"
              placeholderTextColor="#555555"
              autoCapitalize="none"
            />
          </View>

          {/* Referral Source */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>HOW DID YOU HEAR ABOUT US?</Text>
            <Pressable onPress={() => setPickerVisible(true)} style={styles.input}>
              <Text style={[styles.pickerText, !referralSource && styles.pickerPlaceholder]}>
                {selectedLabel}
              </Text>
            </Pressable>
          </View>

          {/* Other referral */}
          {referralSource === 'other' && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>PLEASE SPECIFY</Text>
              <TextInput
                style={styles.input}
                value={referralOther}
                onChangeText={setReferralOther}
                placeholder="How did you find us?"
                placeholderTextColor="#555555"
              />
            </View>
          )}

          {/* Friend referral name */}
          {referralSource === 'friend' && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>REFERRAL NAME <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={styles.input}
                value={referralOther}
                onChangeText={setReferralOther}
                placeholder="Who referred you?"
                placeholderTextColor="#555555"
              />
            </View>
          )}

          {/* Referral Code */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>REFERRAL CODE <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={styles.input}
              value={referralCode}
              onChangeText={setReferralCode}
              placeholder="Enter referral code"
              placeholderTextColor="#555555"
              autoCapitalize="none"
            />
          </View>

          {/* Submit */}
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
                <Text style={styles.buttonText}>Sign Up</Text>
              )}
            </LinearGradient>
          </Pressable>

          {/* Switch to Login */}
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Already have an account? </Text>
            <Pressable onPress={() => navigation.navigate('Login')}>
              <Text style={styles.switchLink}>Sign In</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Referral Picker Modal */}
      <Modal visible={pickerVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setPickerVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>How did you hear about us?</Text>
            <FlatList
              data={REFERRAL_OPTIONS}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setReferralSource(item.value);
                    setPickerVisible(false);
                  }}
                  style={[
                    styles.modalOption,
                    referralSource === item.value && styles.modalOptionActive,
                  ]}
                >
                  <Text style={[
                    styles.modalOptionText,
                    referralSource === item.value && styles.modalOptionTextActive,
                  ]}>
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingVertical: 16 },
  backRow: { marginBottom: 16 },
  backText: { color: '#888888', fontSize: 14 },
  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 36, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2 },
  logoAccent: { color: '#EF4444' },
  subtitle: { color: '#888888', fontSize: 14, marginTop: 8 },
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
  optional: { color: '#333333' },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 8,
    marginBottom: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#222222' },
  dividerText: { color: '#555555', fontSize: 11, letterSpacing: 1 },
  nameRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  nameField: { flex: 1 },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
  },
  genderButtonActive: { backgroundColor: '#EF4444' },
  genderText: { color: '#888888', fontSize: 14, fontWeight: '500' },
  genderTextActive: { color: '#FFFFFF' },
  pickerText: { color: '#FFFFFF', fontSize: 16 },
  pickerPlaceholder: { color: '#555555' },
  button: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, marginBottom: 32 },
  switchText: { color: '#888888', fontSize: 14 },
  switchLink: { color: '#EF4444', fontSize: 14, fontWeight: '500' },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '50%',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  modalOptionActive: { backgroundColor: 'rgba(239,68,68,0.1)' },
  modalOptionText: { color: '#888888', fontSize: 16 },
  modalOptionTextActive: { color: '#EF4444', fontWeight: '500' },
});
