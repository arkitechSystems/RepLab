import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { startOfWeek, addDays, format, isToday, isSameWeek } from 'date-fns';
import { api } from '../api';
import { getWorkoutColor } from '../utils/workoutColors';
import { colors } from '../theme';

// ─── Types ───────────────────────────────────────────────────────────

interface ScheduleEntry {
  dayOfWeek: number;
  templateId: number | null;
  templateName?: string;
}

interface Template {
  id: number;
  name: string;
  programId: number | null;
  isRest?: boolean;
}

interface Program {
  id: number;
  name: string;
}

interface CompletedSession {
  templateId: number;
  date: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Component ───────────────────────────────────────────────────────

export default function CalendarScreen({ navigation }: any) {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [editingDay, setEditingDay] = useState<Date | null>(null);
  const [expandedProgram, setExpandedProgram] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);

  // ─── Data fetching ──────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [sched, tmpls, progs, completed] = await Promise.all([
        api('/schedule'),
        api('/templates'),
        api('/programs'),
        api('/sessions/completed'),
      ]);
      setSchedule(sched || []);
      setTemplates(tmpls || []);
      setPrograms(progs || []);
      setCompletedSessions(completed || []);
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load schedule');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // ─── Week helpers ───────────────────────────────────────────────────

  const today = new Date();
  const baseWeekStart = startOfWeek(today, { weekStartsOn: 0 });
  const weekStart = addDays(baseWeekStart, weekOffset * 7);
  const weekEnd = addDays(weekStart, 6);
  const isCurrentWeek = isSameWeek(weekStart, today, { weekStartsOn: 0 });

  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    weekDays.push(addDays(weekStart, i));
  }

  const subtitle = `Week of ${format(weekStart, 'MMM d')} — ${format(weekEnd, 'MMM d, yyyy')}`;

  // ─── Schedule helpers ───────────────────────────────────────────────

  function getWorkoutForDay(date: Date): ScheduleEntry | undefined {
    const dow = date.getDay();
    return schedule.find((s) => s.dayOfWeek === dow);
  }

  function getTemplateName(entry: ScheduleEntry | undefined): string | null {
    if (!entry || entry.templateId == null) return null;
    if (entry.templateName) return entry.templateName;
    const tmpl = templates.find((t) => t.id === entry.templateId);
    return tmpl?.name || null;
  }

  function isDayCompleted(date: Date): boolean {
    const workout = getWorkoutForDay(date);
    if (!workout || workout.templateId == null) return false;
    const dateStr = format(date, 'yyyy-MM-dd');
    return completedSessions.some(
      (c) => c.templateId === workout.templateId && c.date === dateStr
    );
  }

  // ─── Swap / Clear handlers ─────────────────────────────────────────

  async function handleSwap(templateId: number) {
    if (!editingDay) return;
    const dow = editingDay.getDay();
    setScheduleSaving(true);
    try {
      await api('/schedule', {
        method: 'PUT',
        body: JSON.stringify({ schedule: [{ dayOfWeek: dow, templateId }] }),
      });
      const [updated, completed] = await Promise.all([
        api('/schedule'),
        api('/sessions/completed'),
      ]);
      setSchedule(updated || []);
      setCompletedSessions(completed || []);
      setEditingDay(null);
    } catch {
      // silently fail for now
    } finally {
      setScheduleSaving(false);
    }
  }

  async function handleClearDay() {
    if (!editingDay) return;
    const dow = editingDay.getDay();
    setScheduleSaving(true);
    try {
      await api('/schedule', {
        method: 'PUT',
        body: JSON.stringify({ schedule: [{ dayOfWeek: dow, templateId: null }] }),
      });
      const [updated, completed] = await Promise.all([
        api('/schedule'),
        api('/sessions/completed'),
      ]);
      setSchedule(updated || []);
      setCompletedSessions(completed || []);
      setEditingDay(null);
    } catch {
      // silently fail for now
    } finally {
      setScheduleSaving(false);
    }
  }

  // ─── Picker data ───────────────────────────────────────────────────

  const filteredPrograms = programs
    .map((prog) => {
      const progTemplates = templates.filter((t) => {
        if (t.programId !== prog.id) return false;
        if (t.isRest) return false;
        if (pickerSearch) {
          return t.name.toLowerCase().includes(pickerSearch.toLowerCase());
        }
        return true;
      });
      return { ...prog, templates: progTemplates };
    })
    .filter((p) => p.templates.length > 0);

  const ungroupedTemplates = templates.filter((t) => {
    if (t.programId != null) return false;
    if (t.isRest) return false;
    if (pickerSearch) {
      return t.name.toLowerCase().includes(pickerSearch.toLowerCase());
    }
    return true;
  });

  // ─── Loading / Error states ─────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.wfRed} />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Schedule</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => setWeekOffset((o) => o - 1)}
          >
            <Text style={styles.navChevron}>{'‹'}</Text>
          </TouchableOpacity>

          {!isCurrentWeek && (
            <TouchableOpacity
              style={styles.todayButton}
              onPress={() => setWeekOffset(0)}
            >
              <Text style={styles.todayButtonText}>Today</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.navButton}
            onPress={() => setWeekOffset((o) => o + 1)}
          >
            <Text style={styles.navChevron}>{'›'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Day Cards */}
      <ScrollView
        style={styles.dayList}
        contentContainerStyle={styles.dayListContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.wfRed}
          />
        }
      >
        {weekDays.map((date) => {
          const workout = getWorkoutForDay(date);
          const workoutName = getTemplateName(workout);
          const hasWorkout = workoutName != null;
          const completed = isDayCompleted(date);
          const todayFlag = isToday(date);
          const accentColor = hasWorkout
            ? getWorkoutColor(workoutName!).hex
            : colors.gray[600];
          const completedColor = '#22C55E';

          return (
            <TouchableOpacity
              key={date.toISOString()}
              style={[
                styles.dayCard,
                todayFlag && styles.dayCardToday,
              ]}
              activeOpacity={hasWorkout ? 0.7 : 1}
              onPress={() => {
                if (hasWorkout && workout?.templateId) {
                  navigation.navigate('WorkoutSession', {
                    templateId: String(workout.templateId),
                    date: format(date, 'yyyy-MM-dd'),
                  });
                }
              }}
            >
              {/* Accent bar */}
              <View
                style={[
                  styles.accentBar,
                  {
                    backgroundColor: completed
                      ? completedColor
                      : accentColor,
                  },
                ]}
              />

              {/* Day circle */}
              <View style={styles.dayCircleWrapper}>
                {todayFlag ? (
                  <LinearGradient
                    colors={['#EF4444', '#DC2626']}
                    style={styles.dayCircle}
                  >
                    <Text style={styles.dayAbbrevToday}>
                      {DAY_NAMES[date.getDay()]}
                    </Text>
                    <Text style={styles.dayNumberToday}>
                      {format(date, 'd')}
                    </Text>
                  </LinearGradient>
                ) : completed ? (
                  <View
                    style={[
                      styles.dayCircle,
                      { backgroundColor: 'rgba(34,197,94,0.15)' },
                    ]}
                  >
                    <Text style={[styles.dayAbbrev, { color: completedColor }]}>
                      {DAY_NAMES[date.getDay()]}
                    </Text>
                    <Text style={[styles.dayNumber, { color: completedColor }]}>
                      {format(date, 'd')}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.dayCircle}>
                    <Text style={styles.dayAbbrev}>
                      {DAY_NAMES[date.getDay()]}
                    </Text>
                    <Text style={styles.dayNumber}>
                      {format(date, 'd')}
                    </Text>
                  </View>
                )}
              </View>

              {/* Workout info */}
              <View style={styles.dayInfo}>
                <Text
                  style={[
                    styles.workoutName,
                    !hasWorkout && styles.workoutNameEmpty,
                  ]}
                  numberOfLines={1}
                >
                  {hasWorkout ? workoutName : 'Rest'}
                </Text>

                {/* Status badge */}
                {todayFlag && (
                  <View style={styles.badgeToday}>
                    <Text style={styles.badgeTodayText}>Today</Text>
                  </View>
                )}
                {completed && (
                  <View style={styles.badgeComplete}>
                    <Text style={styles.badgeCompleteText}>Complete</Text>
                  </View>
                )}
              </View>

              {/* Edit button */}
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
                  setEditingDay(date);
                  setPickerSearch('');
                  setExpandedProgram(null);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.editIcon}>{'✎'}</Text>
              </TouchableOpacity>

              {/* Chevron */}
              {hasWorkout && (
                <Text style={styles.cardChevron}>{'›'}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ─── Workout Picker Modal ──────────────────────────────────── */}
      <Modal
        visible={editingDay !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingDay(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {editingDay && getWorkoutForDay(editingDay)?.templateId
                    ? 'Change Workout'
                    : 'Assign Workout'}
                </Text>
                {editingDay && (
                  <Text style={styles.modalSubtitle}>
                    {format(editingDay, 'EEEE, MMM d')}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setEditingDay(null)}
              >
                <Text style={styles.modalCloseText}>{'✕'}</Text>
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search workouts..."
                placeholderTextColor={colors.gray[500]}
                value={pickerSearch}
                onChangeText={setPickerSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Saving overlay */}
            {scheduleSaving && (
              <View style={styles.savingOverlay}>
                <ActivityIndicator size="small" color={colors.wfRed} />
                <Text style={styles.savingText}>Saving...</Text>
              </View>
            )}

            {/* Program list */}
            <ScrollView
              style={styles.modalList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {filteredPrograms.map((prog) => (
                <View key={prog.id} style={styles.programSection}>
                  <TouchableOpacity
                    style={styles.programHeader}
                    onPress={() =>
                      setExpandedProgram(
                        expandedProgram === prog.id ? null : prog.id
                      )
                    }
                  >
                    <Text style={styles.programName}>{prog.name}</Text>
                    <Text style={styles.programChevron}>
                      {expandedProgram === prog.id ? '▾' : '▸'}
                    </Text>
                  </TouchableOpacity>

                  {expandedProgram === prog.id &&
                    prog.templates.map((tmpl) => (
                      <TouchableOpacity
                        key={tmpl.id}
                        style={styles.templateRow}
                        onPress={() => handleSwap(tmpl.id)}
                        disabled={scheduleSaving}
                      >
                        <View
                          style={[
                            styles.templateDot,
                            { backgroundColor: getWorkoutColor(tmpl.name).hex },
                          ]}
                        />
                        <Text style={styles.templateName}>{tmpl.name}</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              ))}

              {/* Ungrouped templates */}
              {ungroupedTemplates.length > 0 && (
                <View style={styles.programSection}>
                  <View style={styles.programHeader}>
                    <Text style={styles.programName}>Other Workouts</Text>
                  </View>
                  {ungroupedTemplates.map((tmpl) => (
                    <TouchableOpacity
                      key={tmpl.id}
                      style={styles.templateRow}
                      onPress={() => handleSwap(tmpl.id)}
                      disabled={scheduleSaving}
                    >
                      <View
                        style={[
                          styles.templateDot,
                          { backgroundColor: getWorkoutColor(tmpl.name).hex },
                        ]}
                      />
                      <Text style={styles.templateName}>{tmpl.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {filteredPrograms.length === 0 && ungroupedTemplates.length === 0 && (
                <View style={styles.emptyPicker}>
                  <Text style={styles.emptyPickerText}>
                    {pickerSearch ? 'No workouts match your search' : 'No workouts available'}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Bottom actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.restDayButton}
                onPress={handleClearDay}
                disabled={scheduleSaving}
              >
                <Text style={styles.restDayButtonText}>Set as Rest Day</Text>
              </TouchableOpacity>

              {editingDay &&
                getWorkoutForDay(editingDay)?.templateId != null && (
                  <TouchableOpacity
                    style={styles.clearDayButton}
                    onPress={handleClearDay}
                    disabled={scheduleSaving}
                  >
                    <Text style={styles.clearDayButtonText}>Clear Day</Text>
                  </TouchableOpacity>
                )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: colors.wfRed,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: colors.wfRed,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 15,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: colors.gray[400],
    marginBottom: 12,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navChevron: {
    fontSize: 24,
    color: colors.white,
    fontWeight: '300',
  },
  todayButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  todayButtonText: {
    color: colors.wfRed,
    fontSize: 13,
    fontWeight: '600',
  },

  // Day list
  dayList: {
    flex: 1,
  },
  dayListContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 8,
  },

  // Day card
  dayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
    paddingRight: 12,
    overflow: 'hidden',
  },
  dayCardToday: {
    borderColor: colors.wfRed,
    borderWidth: 2,
  },
  accentBar: {
    width: 3,
    height: '100%',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },

  // Day circle
  dayCircleWrapper: {
    marginLeft: 14,
    marginRight: 12,
  },
  dayCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayAbbrev: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.gray[400],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayAbbrevToday: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray[400],
    marginTop: -1,
  },
  dayNumberToday: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    marginTop: -1,
  },

  // Day info
  dayInfo: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
  },
  workoutName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
  workoutNameEmpty: {
    color: colors.gray[500],
    fontWeight: '400',
  },
  badgeToday: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeTodayText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.wfRed,
  },
  badgeComplete: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeCompleteText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#22C55E',
  },

  // Edit / Chevron
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  editIcon: {
    fontSize: 14,
    color: colors.gray[400],
  },
  cardChevron: {
    fontSize: 20,
    color: colors.gray[500],
    marginLeft: 4,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.gray[900],
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.gray[400],
    marginTop: 2,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: colors.gray[400],
    fontWeight: '600',
  },

  // Search
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  // Saving overlay
  savingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  savingText: {
    color: colors.gray[400],
    fontSize: 13,
  },

  // Program list
  modalList: {
    paddingHorizontal: 20,
  },
  programSection: {
    marginBottom: 8,
  },
  programHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  programName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
  programChevron: {
    fontSize: 14,
    color: colors.gray[400],
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    marginBottom: 4,
  },
  templateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  templateName: {
    fontSize: 15,
    color: colors.white,
  },

  // Empty picker
  emptyPicker: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyPickerText: {
    color: colors.gray[500],
    fontSize: 14,
  },

  // Modal actions
  modalActions: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
  },
  restDayButton: {
    backgroundColor: 'rgba(249,115,22,0.12)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  restDayButtonText: {
    color: colors.wfOrange,
    fontSize: 15,
    fontWeight: '600',
  },
  clearDayButton: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  clearDayButtonText: {
    color: colors.gray[400],
    fontSize: 15,
    fontWeight: '600',
  },
});
