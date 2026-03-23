import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { getWorkoutColor } from '../utils/workoutColors';
import GlassCard from '../components/GlassCard';
import GradientButton from '../components/GradientButton';
import { colors } from '../theme';

type Metrics = {
  height: number | null;
  weight: number | null;
  bodyFat: number | null;
  maxBench: number | null;
  maxSquat: number | null;
  maxDeadlift: number | null;
};

function MetricRow({
  label,
  value,
  unit,
  onChange,
}: {
  label: string;
  value: number | null;
  unit: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricInputWrap}>
        <TextInput
          style={styles.metricInput}
          value={value != null ? String(value) : ''}
          onChangeText={(t) => onChange(t === '' ? null : Number(t))}
          placeholder="—"
          placeholderTextColor={colors.gray[600]}
          keyboardType="decimal-pad"
          returnKeyType="done"
        />
        <Text style={styles.metricUnit}>{unit}</Text>
      </View>
    </View>
  );
}

export default function Profile({ navigation }: any) {
  const { user, logout } = useAuth();

  const [metrics, setMetrics] = useState<Metrics>({
    height: null,
    weight: null,
    bodyFat: null,
    maxBench: null,
    maxSquat: null,
    maxDeadlift: null,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Feedback
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'bug' | 'idea'>('bug');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  // Change password
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  useEffect(() => {
    api('/metrics')
      .then(setMetrics)
      .catch((err: any) => { if (err.name !== 'AbortError') console.error(err); });
    api('/sessions')
      .then(setSessions)
      .catch((err: any) => { if (err.name !== 'AbortError') console.error(err); })
      .finally(() => setSessionsLoading(false));
  }, []);

  function updateMetric(field: keyof Metrics, value: number | null) {
    setMetrics((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSaveMetrics() {
    setSaving(true);
    try {
      const result = await api('/metrics', {
        method: 'PUT',
        body: JSON.stringify(metrics),
      });
      setMetrics(result);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleFeedbackSubmit() {
    if (!feedbackMsg.trim()) return;
    setFeedbackSending(true);
    try {
      await api('/feedback', {
        method: 'POST',
        body: JSON.stringify({
          type: feedbackType === 'bug' ? 'Bug Report' : 'Improvement Idea',
          message: feedbackMsg.trim(),
        }),
      });
      setFeedbackSent(true);
      setFeedbackMsg('');
      setTimeout(() => {
        setFeedbackSent(false);
        setShowFeedback(false);
      }, 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setFeedbackSending(false);
    }
  }

  async function handleChangePassword() {
    setPasswordError('');
    setPasswordChanged(false);
    const pe: string[] = [];
    if (newPassword.length < 8) pe.push('at least 8 characters');
    if (!/[A-Z]/.test(newPassword)) pe.push('at least 1 uppercase letter');
    if (!/[0-9]/.test(newPassword)) pe.push('at least 1 number');
    if (/\s/.test(newPassword)) pe.push('no spaces');
    if (pe.length > 0) {
      setPasswordError('Password must have: ' + pe.join(', '));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    setPasswordSaving(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPasswordChanged(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setPasswordSaving(false);
    }
  }

  const initials = (user?.firstName || user?.email || user?.phone || 'W')[0].toUpperCase();

  const planColor =
    user?.plan === 'Elite' ? '#A855F7' :
    user?.plan === 'Pro' ? '#3B82F6' :
    '#22C55E';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <Text style={styles.title}>Profile</Text>

        {/* ── Member Info ── */}
        <GlassCard style={styles.card}>
          <View style={styles.memberRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.email || user?.phone || 'User'}
              </Text>
              {user?.firstName && (
                <Text style={styles.userSub}>{user?.email || user?.phone}</Text>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          {user?.email && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user.email}</Text>
            </View>
          )}
          {user?.phone && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{user.phone}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Plan</Text>
            <Text style={[styles.infoValue, { color: planColor, fontWeight: '600' }]}>
              {user?.plan || 'Free'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account ID</Text>
            <Text style={[styles.infoValue, { color: colors.gray[500] }]}>#{user?.id}</Text>
          </View>
        </GlassCard>

        {/* ── Beta Feedback ── */}
        <GlassCard style={[styles.card, styles.feedbackCard]}>
          <View style={styles.feedbackHeader}>
            <View style={styles.feedbackIcon}>
              <Text style={{ color: colors.wfRed, fontSize: 16 }}>!</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.feedbackTitle}>Alpha Version</Text>
              <Text style={styles.feedbackSub}>
                Send us any bugs or improvement ideas you have!
              </Text>
            </View>
            {!showFeedback && (
              <Pressable
                onPress={() => setShowFeedback(true)}
                style={styles.feedbackBtn}
              >
                <LinearGradient
                  colors={['#EF4444', '#DC2626']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.feedbackBtnGradient}
                >
                  <Text style={styles.feedbackBtnText}>Send Feedback</Text>
                </LinearGradient>
              </Pressable>
            )}
          </View>

          {showFeedback && (
            <View style={styles.feedbackForm}>
              <View style={styles.divider} />
              {feedbackSent ? (
                <View style={styles.feedbackSuccess}>
                  <View style={styles.checkCircle}>
                    <Text style={{ color: '#22C55E', fontSize: 20, fontWeight: '700' }}>✓</Text>
                  </View>
                  <Text style={[styles.feedbackTitle, { textAlign: 'center' }]}>Thanks for your feedback!</Text>
                  <Text style={[styles.feedbackSub, { textAlign: 'center' }]}>We'll review it shortly.</Text>
                </View>
              ) : (
                <>
                  <View style={styles.typeRow}>
                    <Pressable
                      onPress={() => setFeedbackType('bug')}
                      style={[
                        styles.typeBtn,
                        feedbackType === 'bug' && styles.typeBtnActiveBug,
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeBtnText,
                          feedbackType === 'bug' && { color: colors.wfRed },
                        ]}
                      >
                        Bug Report
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setFeedbackType('idea')}
                      style={[
                        styles.typeBtn,
                        feedbackType === 'idea' && styles.typeBtnActiveIdea,
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeBtnText,
                          feedbackType === 'idea' && { color: colors.wfBlue },
                        ]}
                      >
                        Improvement Idea
                      </Text>
                    </Pressable>
                  </View>

                  <TextInput
                    style={styles.feedbackInput}
                    value={feedbackMsg}
                    onChangeText={setFeedbackMsg}
                    placeholder={feedbackType === 'bug' ? 'Describe the bug...' : 'Share your idea...'}
                    placeholderTextColor={colors.gray[600]}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />

                  <View style={styles.feedbackActions}>
                    <Pressable
                      onPress={() => { setShowFeedback(false); setFeedbackMsg(''); }}
                      style={styles.feedbackCancel}
                    >
                      <Text style={styles.feedbackCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleFeedbackSubmit}
                      disabled={!feedbackMsg.trim() || feedbackSending}
                      style={{ flex: 1 }}
                    >
                      <LinearGradient
                        colors={['#EF4444', '#DC2626']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          styles.feedbackSubmitGrad,
                          (!feedbackMsg.trim() || feedbackSending) && { opacity: 0.4 },
                        ]}
                      >
                        <Text style={styles.feedbackBtnText}>
                          {feedbackSending ? 'Sending...' : 'Submit'}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          )}
        </GlassCard>

        {/* ── Body Metrics ── */}
        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>Body Metrics</Text>
          <MetricRow label="Height" value={metrics.height} unit="in" onChange={(v) => updateMetric('height', v)} />
          <MetricRow label="Weight" value={metrics.weight} unit="lbs" onChange={(v) => updateMetric('weight', v)} />
          <MetricRow label="Body Fat" value={metrics.bodyFat} unit="%" onChange={(v) => updateMetric('bodyFat', v)} />
          <MetricRow label="Max Bench" value={metrics.maxBench} unit="lbs" onChange={(v) => updateMetric('maxBench', v)} />
          <MetricRow label="Max Squat" value={metrics.maxSquat} unit="lbs" onChange={(v) => updateMetric('maxSquat', v)} />
          <MetricRow label="Max Deadlift" value={metrics.maxDeadlift} unit="lbs" onChange={(v) => updateMetric('maxDeadlift', v)} />
        </GlassCard>

        {/* Save Metrics */}
        <GradientButton
          title={saving ? 'Saving...' : saved ? 'Saved!' : 'Save Metrics'}
          onPress={handleSaveMetrics}
          loading={saving}
          disabled={saving}
          colors={saved ? ['#16A34A', '#16A34A'] : undefined}
          style={styles.card}
        />

        {/* ── Change Password ── */}
        <GlassCard style={styles.card}>
          <Pressable
            onPress={() => {
              setShowChangePassword(!showChangePassword);
              setPasswordError('');
              setPasswordChanged(false);
              setCurrentPassword('');
              setNewPassword('');
              setConfirmNewPassword('');
            }}
            style={styles.changePassHeader}
          >
            <Text style={styles.sectionTitle}>Change Password</Text>
            <Text style={styles.chevron}>{showChangePassword ? '▲' : '▼'}</Text>
          </Pressable>

          {showChangePassword && (
            <View style={{ marginTop: 12 }}>
              <View style={styles.divider} />

              {passwordError !== '' && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{passwordError}</Text>
                </View>
              )}
              {passwordChanged && (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>Password changed successfully!</Text>
                </View>
              )}

              <Text style={styles.inputLabel}>Current Password</Text>
              <TextInput
                style={styles.darkInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor={colors.gray[500]}
                secureTextEntry
              />

              <Text style={styles.inputLabel}>New Password</Text>
              <TextInput
                style={styles.darkInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor={colors.gray[500]}
                secureTextEntry
              />

              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <TextInput
                style={styles.darkInput}
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                placeholder="Confirm new password"
                placeholderTextColor={colors.gray[500]}
                secureTextEntry
              />

              <GradientButton
                title={passwordSaving ? 'Changing...' : 'Change Password'}
                onPress={handleChangePassword}
                loading={passwordSaving}
                disabled={passwordSaving || !currentPassword || !newPassword || !confirmNewPassword}
                style={{ marginTop: 12 }}
              />
            </View>
          )}
        </GlassCard>

        {/* ── Recent Sessions ── */}
        <GlassCard style={styles.card}>
          <Text style={styles.sectionTitle}>Recent Workouts</Text>
          {sessionsLoading ? (
            <ActivityIndicator color={colors.gray[400]} style={{ marginVertical: 16 }} />
          ) : sessions.length === 0 ? (
            <Text style={styles.emptyText}>No workouts logged yet</Text>
          ) : (
            <>
              {sessions.slice(0, 5).map((session: any) => {
                const wc = getWorkoutColor(session.templateName);
                return (
                  <Pressable
                    key={session.id}
                    onPress={() => navigation.navigate('SessionDetail', { sessionId: session.id })}
                    style={styles.sessionRow}
                  >
                    <View style={[styles.sessionDot, { backgroundColor: wc.hex }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sessionName}>{session.templateName}</Text>
                      <Text style={styles.sessionDate}>
                        {format(parseISO(session.date), 'EEEE, MMM d, yyyy')}
                      </Text>
                    </View>
                    <Text style={{ color: colors.gray[500], fontSize: 14 }}>›</Text>
                  </Pressable>
                );
              })}
              {sessions.length > 5 && (
                <Pressable onPress={() => navigation.navigate('History')}>
                  <Text style={styles.viewAll}>View all {sessions.length} sessions</Text>
                </Pressable>
              )}
            </>
          )}
        </GlassCard>

        {/* ── Logout ── */}
        <Pressable onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#000',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  title: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  card: {
    marginBottom: 12,
  },

  /* ── Member Info ── */
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(239,68,68,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.wfRed,
    fontSize: 22,
    fontWeight: '700',
  },
  userName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  userSub: {
    color: colors.gray[500],
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  infoLabel: {
    color: colors.gray[400],
    fontSize: 14,
  },
  infoValue: {
    color: '#FFF',
    fontSize: 14,
  },

  /* ── Feedback ── */
  feedbackCard: {
    borderColor: 'rgba(239,68,68,0.2)',
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  feedbackIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  feedbackSub: {
    color: colors.gray[400],
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  feedbackBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  feedbackBtnGradient: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  feedbackBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  feedbackForm: {
    marginTop: 8,
  },
  feedbackSuccess: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  checkCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  typeBtnActiveBug: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.4)',
  },
  typeBtnActiveIdea: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderColor: 'rgba(59,130,246,0.4)',
  },
  typeBtnText: {
    color: colors.gray[400],
    fontSize: 12,
    fontWeight: '600',
  },
  feedbackInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    color: '#FFF',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 80,
  },
  feedbackActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  feedbackCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  feedbackCancelText: {
    color: colors.gray[400],
    fontSize: 12,
    fontWeight: '600',
  },
  feedbackSubmitGrad: {
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },

  /* ── Metrics ── */
  sectionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  metricLabel: {
    color: colors.gray[400],
    fontSize: 14,
  },
  metricInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricInput: {
    width: 72,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
  },
  metricUnit: {
    color: colors.gray[500],
    fontSize: 12,
    width: 26,
  },

  /* ── Change Password ── */
  changePassHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chevron: {
    color: colors.gray[400],
    fontSize: 12,
  },
  inputLabel: {
    color: colors.gray[400],
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 4,
  },
  darkInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 14,
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
  },
  successBox: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  successText: {
    color: '#86EFAC',
    fontSize: 13,
  },

  /* ── Sessions ── */
  emptyText: {
    color: colors.gray[500],
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  sessionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sessionName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sessionDate: {
    color: colors.gray[400],
    fontSize: 12,
    marginTop: 1,
  },
  viewAll: {
    color: colors.wfRed,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 8,
  },

  /* ── Logout ── */
  logoutBtn: {
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginTop: 4,
  },
  logoutText: {
    color: colors.wfRed,
    fontSize: 16,
    fontWeight: '600',
  },
});
