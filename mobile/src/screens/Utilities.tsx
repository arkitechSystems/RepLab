import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { colors } from '../theme';

// ── Muscle group classification ──────────────────────────────────

const MUSCLE_GROUPS = [
  'Chest', 'Shoulders', 'Traps', 'Biceps', 'Back',
  'Triceps', 'Quads', 'Glutes', 'Hamstrings',
];

const MUSCLE_KEYWORDS: Record<string, string[]> = {
  Chest: ['bench press', 'chest', 'fly', 'flye', 'dip', 'push up', 'pushup', 'pec'],
  Shoulders: ['shoulder press', 'overhead press', 'lateral raise', 'front raise', 'face pull', 'delt', 'arnold', 'military press'],
  Traps: ['shrug', 'trap', 'upright row'],
  Biceps: ['curl', 'bicep', 'hammer curl', 'preacher'],
  Back: ['row', 'pulldown', 'pull-up', 'pull up', 'pullup', 'lat', 'deadlift', 'back'],
  Triceps: ['tricep', 'pushdown', 'skull crusher', 'close grip', 'extension', 'kickback'],
  Quads: ['squat', 'leg press', 'leg extension', 'lunge', 'split squat', 'front squat', 'quad'],
  Glutes: ['hip thrust', 'glute', 'bridge', 'kickback'],
  Hamstrings: ['hamstring', 'leg curl', 'romanian deadlift', 'rdl', 'stiff leg', 'nordic'],
};

const MUSCLE_PRIORITY = [
  'Hamstrings', 'Glutes', 'Quads', 'Traps',
  'Biceps', 'Triceps', 'Shoulders', 'Chest', 'Back',
];

function classifyExercise(name: string): string | null {
  const lower = name.toLowerCase();
  for (const group of MUSCLE_PRIORITY) {
    if (MUSCLE_KEYWORDS[group].some(kw => lower.includes(kw))) return group;
  }
  return null;
}

// ── Plate calculator logic ───────────────────────────────────────

const STANDARD_PLATES = [45, 35, 25, 10, 5, 2.5];

function calculatePlates(target: number, bar: number): number[] {
  let perSide = (target - bar) / 2;
  if (perSide <= 0) return [];
  const plates: number[] = [];
  for (const plate of STANDARD_PLATES) {
    while (perSide >= plate) {
      plates.push(plate);
      perSide -= plate;
    }
  }
  return plates;
}

// ── Types ────────────────────────────────────────────────────────

interface PB {
  exerciseName: string;
  bestWeight: number;
  bestReps: number;
  achievedAt?: string;
  sessionId?: number;
}

interface GroupedPBs {
  [muscle: string]: {
    [exercise: string]: { weight: number; reps: number; achievedAt?: string }[];
  };
}

// ── Section header component ─────────────────────────────────────

function SectionCard({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.glassCard}>
      <Pressable style={styles.sectionHeader} onPress={onToggle}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
      </Pressable>
      {expanded && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────

export default function UtilitiesScreen() {
  // -- PRs state
  const [pbs, setPbs] = useState<PB[]>([]);
  const [pbsLoading, setPbsLoading] = useState(true);
  const [pbsError, setPbsError] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // -- 1RM state
  const [oneRmWeight, setOneRmWeight] = useState('');
  const [oneRmReps, setOneRmReps] = useState('');

  // -- Plate calc state
  const [plateTarget, setPlateTarget] = useState('');
  const [barWeight, setBarWeight] = useState(45);

  // -- Converter state
  const [converterValue, setConverterValue] = useState('');
  const [converterMode, setConverterMode] = useState<'lbs_to_kg' | 'kg_to_lbs'>('lbs_to_kg');

  // -- Section expand state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    prs: true,
    oneRm: false,
    plates: false,
    converter: false,
  });

  const toggleSection = (key: string) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Fetch PRs ──────────────────────────────────────────────────

  const fetchPbs = useCallback(async () => {
    try {
      setPbsError(null);
      const data = await api('/pbs');
      setPbs(data);
    } catch (err: any) {
      setPbsError(err.message || 'Failed to load personal bests');
    } finally {
      setPbsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPbs();
  }, [fetchPbs]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPbs();
  }, [fetchPbs]);

  // ── Group PBs by muscle ────────────────────────────────────────

  const grouped: GroupedPBs = useMemo(() => {
    const g: GroupedPBs = {};
    for (const pb of pbs) {
      const muscle = classifyExercise(pb.exerciseName);
      if (!muscle) continue;
      if (!g[muscle]) g[muscle] = {};
      if (!g[muscle][pb.exerciseName]) g[muscle][pb.exerciseName] = [];
      g[muscle][pb.exerciseName].push({
        weight: pb.bestWeight,
        reps: pb.bestReps,
        achievedAt: pb.achievedAt,
      });
    }
    // Sort weights descending within each exercise
    for (const muscle of Object.values(g)) {
      for (const ex of Object.keys(muscle)) {
        muscle[ex].sort((a, b) => b.weight - a.weight);
      }
    }
    return g;
  }, [pbs]);

  // ── 1RM calculation ────────────────────────────────────────────

  const oneRmResult = useMemo(() => {
    const w = parseFloat(oneRmWeight);
    const r = parseInt(oneRmReps, 10);
    if (!w || !r || r < 1 || r > 30) return null;
    if (r === 1) return w;
    return Math.round(w * (1 + r / 30) * 10) / 10;
  }, [oneRmWeight, oneRmReps]);

  // ── Plate calculation ──────────────────────────────────────────

  const plateResult = useMemo(() => {
    const target = parseFloat(plateTarget);
    if (!target || target <= barWeight) return null;
    return calculatePlates(target, barWeight);
  }, [plateTarget, barWeight]);

  // ── Converter ──────────────────────────────────────────────────

  const convertedValue = useMemo(() => {
    const v = parseFloat(converterValue);
    if (!v) return null;
    if (converterMode === 'lbs_to_kg') return Math.round(v * 0.453592 * 100) / 100;
    return Math.round(v * 2.20462 * 100) / 100;
  }, [converterValue, converterMode]);

  // ── Render ─────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.header}>Utilities</Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.wfCyan}
          />
        }
      >
        {/* ── Personal Records ─────────────────────────────────── */}
        <SectionCard
          title="Personal Records"
          expanded={openSections.prs}
          onToggle={() => toggleSection('prs')}
        >
          {pbsLoading ? (
            <ActivityIndicator color={colors.wfCyan} style={{ marginVertical: 24 }} />
          ) : pbsError ? (
            <View style={styles.centered}>
              <Text style={styles.errorText}>{pbsError}</Text>
              <TouchableOpacity onPress={fetchPbs}>
                <Text style={styles.retryText}>Tap to retry</Text>
              </TouchableOpacity>
            </View>
          ) : Object.keys(grouped).length === 0 ? (
            <Text style={styles.emptyText}>
              No personal records yet. Complete some workouts to see your PRs here.
            </Text>
          ) : (
            MUSCLE_GROUPS.filter(g => !!grouped[g]).map(muscle => {
              const isGroupExpanded = expandedGroup === muscle;
              const exerciseCount = Object.keys(grouped[muscle]).length;
              return (
                <View key={muscle} style={styles.muscleCard}>
                  <Pressable
                    style={styles.muscleHeader}
                    onPress={() =>
                      setExpandedGroup(prev => (prev === muscle ? null : muscle))
                    }
                  >
                    <View style={styles.muscleHeaderLeft}>
                      <Text style={styles.muscleName}>{muscle}</Text>
                      <Text style={styles.muscleCount}>
                        {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Text style={styles.chevronSmall}>
                      {isGroupExpanded ? '▾' : '▸'}
                    </Text>
                  </Pressable>

                  {isGroupExpanded &&
                    Object.entries(grouped[muscle]).map(([exercise, records]) => {
                      const isExExpanded = expandedExercise === exercise;
                      return (
                        <View key={exercise} style={styles.exerciseBlock}>
                          <Pressable
                            style={styles.exerciseHeader}
                            onPress={() =>
                              setExpandedExercise(prev =>
                                prev === exercise ? null : exercise,
                              )
                            }
                          >
                            <Text style={styles.exerciseName}>{exercise}</Text>
                            <Text style={styles.chevronTiny}>
                              {isExExpanded ? '▾' : '▸'}
                            </Text>
                          </Pressable>

                          {isExExpanded &&
                            records.map((rec, idx) => (
                              <View key={idx} style={styles.prRow}>
                                <Text style={styles.trophyIcon}>🏆</Text>
                                <Text style={styles.prWeight}>
                                  {rec.weight} lbs
                                </Text>
                                <Text style={styles.prReps}>
                                  x{rec.reps}
                                </Text>
                                {rec.achievedAt && (
                                  <Text style={styles.prDate}>
                                    {new Date(rec.achievedAt).toLocaleDateString()}
                                  </Text>
                                )}
                              </View>
                            ))}
                        </View>
                      );
                    })}
                </View>
              );
            })
          )}
        </SectionCard>

        {/* ── 1RM Calculator ───────────────────────────────────── */}
        <SectionCard
          title="1RM Calculator"
          expanded={openSections.oneRm}
          onToggle={() => toggleSection('oneRm')}
        >
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Weight (lbs)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="225"
                placeholderTextColor={colors.gray[500]}
                value={oneRmWeight}
                onChangeText={setOneRmWeight}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reps (1-30)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="5"
                placeholderTextColor={colors.gray[500]}
                value={oneRmReps}
                onChangeText={setOneRmReps}
              />
            </View>
          </View>

          {oneRmResult !== null && (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>Estimated 1 Rep Max</Text>
              <Text style={styles.resultValue}>{oneRmResult} lbs</Text>
              <Text style={styles.resultSubtext}>Epley Formula</Text>
            </View>
          )}
        </SectionCard>

        {/* ── Plate Calculator ─────────────────────────────────── */}
        <SectionCard
          title="Plate Calculator"
          expanded={openSections.plates}
          onToggle={() => toggleSection('plates')}
        >
          <Text style={styles.inputLabel}>Target Weight (lbs)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="315"
            placeholderTextColor={colors.gray[500]}
            value={plateTarget}
            onChangeText={setPlateTarget}
          />

          <Text style={[styles.inputLabel, { marginTop: 12 }]}>Bar Weight</Text>
          <View style={styles.barRow}>
            {[45, 35, 25].map(w => (
              <TouchableOpacity
                key={w}
                style={[
                  styles.barBtn,
                  barWeight === w && styles.barBtnActive,
                ]}
                onPress={() => setBarWeight(w)}
              >
                <Text
                  style={[
                    styles.barBtnText,
                    barWeight === w && styles.barBtnTextActive,
                  ]}
                >
                  {w} lbs
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {plateResult !== null && (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>Plates Per Side</Text>
              {plateResult.length === 0 ? (
                <Text style={styles.resultSubtext}>
                  Target equals bar weight -- no plates needed
                </Text>
              ) : (
                <View style={styles.plateList}>
                  {plateResult.map((plate, idx) => (
                    <View key={idx} style={styles.plateBadge}>
                      <Text style={styles.plateBadgeText}>{plate}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Text style={styles.resultSubtext}>
                Total: {plateTarget} lbs ({barWeight} bar + {plateResult.reduce((s, p) => s + p, 0) * 2} plates)
              </Text>
            </View>
          )}
        </SectionCard>

        {/* ── Unit Converter ───────────────────────────────────── */}
        <SectionCard
          title="Unit Converter"
          expanded={openSections.converter}
          onToggle={() => toggleSection('converter')}
        >
          <View style={styles.converterToggle}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                converterMode === 'lbs_to_kg' && styles.toggleBtnActive,
              ]}
              onPress={() => setConverterMode('lbs_to_kg')}
            >
              <Text
                style={[
                  styles.toggleBtnText,
                  converterMode === 'lbs_to_kg' && styles.toggleBtnTextActive,
                ]}
              >
                lbs → kg
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                converterMode === 'kg_to_lbs' && styles.toggleBtnActive,
              ]}
              onPress={() => setConverterMode('kg_to_lbs')}
            >
              <Text
                style={[
                  styles.toggleBtnText,
                  converterMode === 'kg_to_lbs' && styles.toggleBtnTextActive,
                ]}
              >
                kg → lbs
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder={converterMode === 'lbs_to_kg' ? 'Enter lbs' : 'Enter kg'}
            placeholderTextColor={colors.gray[500]}
            value={converterValue}
            onChangeText={setConverterValue}
          />

          {convertedValue !== null && (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>
                {converterMode === 'lbs_to_kg' ? 'Kilograms' : 'Pounds'}
              </Text>
              <Text style={styles.resultValue}>
                {convertedValue} {converterMode === 'lbs_to_kg' ? 'kg' : 'lbs'}
              </Text>
            </View>
          )}
        </SectionCard>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.white,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },

  // Glass card sections
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  sectionBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  chevron: {
    fontSize: 18,
    color: colors.gray[400],
  },

  // PRs
  muscleCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  muscleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  muscleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  muscleName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  muscleCount: {
    fontSize: 12,
    color: colors.gray[400],
  },
  chevronSmall: {
    fontSize: 14,
    color: colors.gray[400],
  },
  chevronTiny: {
    fontSize: 12,
    color: colors.gray[400],
  },
  exerciseBlock: {
    paddingLeft: 16,
    paddingRight: 12,
    paddingBottom: 4,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.wfCyan,
    flex: 1,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingLeft: 8,
    gap: 8,
  },
  trophyIcon: {
    fontSize: 14,
  },
  prWeight: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  prReps: {
    fontSize: 13,
    color: '#F59E0B',
    fontWeight: '500',
  },
  prDate: {
    fontSize: 12,
    color: colors.gray[400],
    marginLeft: 'auto',
  },

  // Inputs
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray[400],
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.gray[800],
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  // Results
  resultCard: {
    backgroundColor: 'rgba(6,182,212,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.25)',
    padding: 16,
    marginTop: 14,
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.wfCyan,
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.white,
  },
  resultSubtext: {
    fontSize: 12,
    color: colors.gray[400],
    marginTop: 4,
  },

  // Bar weight buttons
  barRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  barBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.gray[800],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  barBtnActive: {
    backgroundColor: 'rgba(6,182,212,0.2)',
    borderColor: colors.wfCyan,
  },
  barBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray[400],
  },
  barBtnTextActive: {
    color: colors.wfCyan,
  },

  // Plate badges
  plateList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 8,
  },
  plateBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  plateBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },

  // Converter toggle
  converterToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.gray[800],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(6,182,212,0.2)',
    borderColor: colors.wfCyan,
  },
  toggleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray[400],
  },
  toggleBtnTextActive: {
    color: colors.wfCyan,
  },

  // Misc
  centered: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorText: {
    color: colors.wfRed,
    fontSize: 14,
    marginBottom: 8,
  },
  retryText: {
    color: colors.wfCyan,
    fontSize: 14,
  },
  emptyText: {
    color: colors.gray[400],
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
    lineHeight: 20,
  },
});
