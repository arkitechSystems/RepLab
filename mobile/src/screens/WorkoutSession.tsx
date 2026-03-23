import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, parseISO, isToday } from 'date-fns';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import ExerciseCard from '../components/ExerciseCard';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme';

const REST_OPTIONS = [30, 45, 60, 75, 90, 105, 120, 150, 180];
const MAX_TIMER_SECS = 14400; // 4 hours

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatRestLabel(s: number): string {
  if (s >= 60) {
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    return rem ? `${mins}m${rem}s` : `${mins}m`;
  }
  return `${s}s`;
}

export default function WorkoutSession({ route, navigation }: any) {
  const { templateId, date } = route.params as { templateId: string; date: string };

  const [template, setTemplate] = useState<any>(null);
  const [pbs, setPbs] = useState<Record<string, Record<string, number>>>({});
  const [entries, setEntries] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [completedSets, setCompletedSets] = useState<Set<string>>(new Set());
  const [newPBs, setNewPBs] = useState<any[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [restDuration, setRestDuration] = useState(90);
  const restDurationRef = useRef(90);
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const timerStorageKey = `wf-timer-${templateId}-${date}`;

  // Keep ref in sync
  useEffect(() => {
    restDurationRef.current = restDuration;
  }, [restDuration]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    };
  }, []);

  // Auto-dismiss PB celebration
  useEffect(() => {
    if (newPBs) {
      const t = setTimeout(() => setNewPBs(null), 4500);
      return () => clearTimeout(t);
    }
  }, [newPBs]);

  // Auto-dismiss saved indicator
  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [saved]);

  // ─── Timer helpers ──────────────────────────────────────────────

  const clearTimerStorage = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(timerStorageKey);
    } catch {}
  }, [timerStorageKey]);

  const runTimerInterval = useCallback((origin: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    startTimeRef.current = origin;
    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - origin) / 1000);
      if (secs >= MAX_TIMER_SECS) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        setElapsed(MAX_TIMER_SECS);
        AsyncStorage.removeItem(`wf-timer-${templateId}-${date}`).catch(() => {});
      } else {
        setElapsed(secs);
      }
    }, 1000);
  }, [templateId, date]);

  const startTimer = useCallback(() => {
    if (timerStarted) return;
    const now = Date.now();
    AsyncStorage.setItem(timerStorageKey, String(now)).catch(() => {});
    setTimerStarted(true);
    setElapsed(0);
    runTimerInterval(now);
  }, [timerStarted, timerStorageKey, runTimerInterval]);

  const startRestTimer = useCallback(() => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    const duration = restDurationRef.current;
    setRestRemaining(duration);
    restTimerRef.current = setInterval(() => {
      setRestRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(restTimerRef.current!);
          restTimerRef.current = null;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopRestTimer = useCallback(() => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    restTimerRef.current = null;
    setRestRemaining(null);
  }, []);

  // ─── Data Loading ───────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        // Fetch PBs
        const pbList = await api(`/pbs?templateId=${templateId}`);
        if (cancelled) return;
        const pbMap: Record<string, Record<string, number>> = {};
        for (const pb of pbList) {
          if (!pbMap[pb.exerciseName]) pbMap[pb.exerciseName] = {};
          pbMap[pb.exerciseName][pb.bestWeight] = pb.bestReps;
        }
        setPbs(pbMap);

        // Get or create session
        let session = await api(`/sessions/by-template/${templateId}/${date}`);
        if (cancelled) return;

        if (!session || !session.workoutData) {
          session = await api('/sessions/initialize', {
            method: 'POST',
            body: JSON.stringify({ templateId: Number(templateId), date }),
          });
        }
        if (cancelled) return;

        // Fallback if still no workout data
        if (!session?.workoutData?.exercises) {
          const templates = await api('/templates');
          if (cancelled) return;
          const tmpl = templates.find((t: any) => t.id === Number(templateId));
          if (tmpl) {
            setTemplate(tmpl);
            if (tmpl.isRest) return;
            const initial: Record<string, any[]> = {};
            for (const ex of tmpl.exercises) {
              initial[ex.name] = ex.sets.map((s: any) => ({
                weight: s.suggestedWeight || '',
                reps: '',
                setType: s.setType || ex.setType || 'straight',
              }));
            }
            setEntries(initial);
          }
          return;
        }

        // Load from session's workout_data
        const wd = session.workoutData;
        const sessionTemplate = {
          id: Number(templateId),
          name: wd.name || 'Workout',
          isRest: false,
          exercises: wd.exercises,
        };
        setTemplate(sessionTemplate);

        // Restore entries
        const restoredEntries: Record<string, any[]> = {};
        const restoredCompleted = new Set<string>();
        const savedByExercise = new Map<string, any[]>();
        for (const entry of session.entries || []) {
          if (!savedByExercise.has(entry.exerciseName)) savedByExercise.set(entry.exerciseName, []);
          savedByExercise.get(entry.exerciseName)!.push(entry);
        }

        for (const ex of wd.exercises) {
          const savedSets = savedByExercise.get(ex.name);
          if (savedSets) {
            savedSets.sort((a: any, b: any) => a.setNumber - b.setNumber);
            restoredEntries[ex.name] = savedSets.map((s: any, i: number) => {
              if (s.isCompleted) restoredCompleted.add(`${ex.name}-${i}`);
              const wdSet = ex.sets?.[i];
              const setType = wdSet?.setType || ex.setType || 'straight';
              return { weight: s.weight || '', reps: s.reps || '', setType };
            });
          } else {
            restoredEntries[ex.name] = ex.sets.map((s: any) => ({
              weight: s.suggestedWeight || '',
              reps: '',
              setType: s.setType || ex.setType || 'straight',
            }));
          }
        }

        setEntries(restoredEntries);
        setCompletedSets(restoredCompleted);
        if (session.notes) setNotes(session.notes);
        if (session.completed) setIsCompleted(true);

        // Restore timer from AsyncStorage
        const storedStart = await AsyncStorage.getItem(`wf-timer-${templateId}-${date}`).catch(() => null);

        if (storedStart && !session.completed) {
          const origin = Number(storedStart);
          const secsSinceStart = Math.floor((Date.now() - origin) / 1000);
          setTimerStarted(true);
          if (secsSinceStart >= MAX_TIMER_SECS) {
            setElapsed(MAX_TIMER_SECS);
            AsyncStorage.removeItem(`wf-timer-${templateId}-${date}`).catch(() => {});
          } else {
            setElapsed(secsSinceStart);
            runTimerInterval(origin);
          }
        } else if (session.entries?.some((e: any) => e.weight > 0 || e.reps > 0)) {
          setTimerStarted(true);
          if (!session.completed) {
            const now = Date.now();
            AsyncStorage.setItem(`wf-timer-${templateId}-${date}`, String(now)).catch(() => {});
            runTimerInterval(now);
          }
        }
      } catch (err: any) {
        if (!cancelled) setLoadError('Failed to load workout — check your connection');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSession();
    return () => { cancelled = true; };
  }, [templateId, date, runTimerInterval]);

  // ─── Handlers ───────────────────────────────────────────────────

  const handleBeginWorkout = useCallback(() => {
    const sessionDate = parseISO(date);
    if (!isToday(sessionDate)) {
      Alert.alert(
        'Different Date',
        `This workout is scheduled for ${format(sessionDate, 'MMMM d, yyyy')}. Start it now?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Start Anyway', onPress: () => startTimer() },
        ],
      );
    } else {
      startTimer();
    }
  }, [date, startTimer]);

  function handleChange(exerciseName: string, setIdx: number, field: string, value: string) {
    setEntries((prev) => {
      const updated = { ...prev };
      updated[exerciseName] = [...(updated[exerciseName] || [])];
      updated[exerciseName][setIdx] = {
        ...updated[exerciseName][setIdx],
        [field]: field === 'setType' ? value : (value === '' ? '' : Number(value)),
      };
      return updated;
    });
  }

  function handleBlur(exerciseName: string, setIdx: number, field: string) {
    const exEntries = entries[exerciseName] || [];
    const value = exEntries[setIdx]?.[field];
    if (value === '' || value === undefined || value === null) return;

    const exercise = template?.exercises?.find((e: any) => e.name === exerciseName);
    if (!exercise) return;

    setEntries((prev) => {
      const updated = { ...prev };
      updated[exerciseName] = [...(updated[exerciseName] || [])];
      for (let i = setIdx + 1; i < exercise.sets.length; i++) {
        const key = `${exerciseName}-${i}`;
        if (!completedSets.has(key)) {
          const current = updated[exerciseName][i]?.[field];
          if (current === '' || current === undefined || current === null) {
            updated[exerciseName][i] = {
              ...updated[exerciseName][i],
              [field]: value,
            };
          }
        }
      }
      return updated;
    });
  }

  function handleToggleComplete(exerciseName: string, setIdx: number) {
    const key = `${exerciseName}-${setIdx}`;
    const isCompleting = !completedSets.has(key);

    setCompletedSets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        startTimer();
        startRestTimer();
      }
      return next;
    });

    // Auto-fill subsequent sets on completion
    if (isCompleting) {
      const exEntries = entries[exerciseName] || [];
      const thisEntry = exEntries[setIdx];
      const w = thisEntry?.weight;
      const r = thisEntry?.reps;
      if ((w !== '' && w !== undefined) || (r !== '' && r !== undefined)) {
        const exercise = template?.exercises?.find((e: any) => e.name === exerciseName);
        if (exercise) {
          setEntries((prev) => {
            const updated = { ...prev };
            updated[exerciseName] = [...(updated[exerciseName] || [])];
            for (let i = setIdx + 1; i < exercise.sets.length; i++) {
              const laterKey = `${exerciseName}-${i}`;
              if (!completedSets.has(laterKey)) {
                const current = updated[exerciseName][i] || {};
                const weightEmpty = current.weight === '' || current.weight === undefined;
                const repsEmpty = current.reps === '' || current.reps === undefined;
                if (weightEmpty || repsEmpty) {
                  updated[exerciseName][i] = {
                    ...current,
                    weight: w !== '' && w !== undefined && weightEmpty ? w : current.weight,
                    reps: r !== '' && r !== undefined && repsEmpty ? r : current.reps,
                  };
                }
              }
            }
            return updated;
          });
        }
      }
    }
  }

  function handleAddSet(exerciseName: string) {
    setTemplate((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex: any) => {
          if (ex.name !== exerciseName) return ex;
          const refSet = ex.sets[ex.sets.length - 1];
          const newSet = {
            setNumber: ex.sets.length + 1,
            plannedReps: refSet?.plannedReps ?? 10,
            suggestedWeight: refSet?.suggestedWeight ?? 0,
          };
          return { ...ex, sets: [...ex.sets, newSet] };
        }),
      };
    });
    setEntries((prev) => {
      const exEntries = prev[exerciseName] || [];
      const refEntry = exEntries[exEntries.length - 1];
      return {
        ...prev,
        [exerciseName]: [...exEntries, { weight: refEntry?.weight ?? '', reps: '' }],
      };
    });
  }

  function handleDeleteSet(exerciseName: string, setIdx: number) {
    setTemplate((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((ex: any) => {
          if (ex.name !== exerciseName || ex.sets.length <= 1) return ex;
          const newSets = ex.sets
            .filter((_: any, i: number) => i !== setIdx)
            .map((s: any, i: number) => ({ ...s, setNumber: i + 1 }));
          return { ...ex, sets: newSets };
        }),
      };
    });
    setEntries((prev) => {
      const exEntries = prev[exerciseName] || [];
      return {
        ...prev,
        [exerciseName]: exEntries.filter((_: any, i: number) => i !== setIdx),
      };
    });
    setCompletedSets((prev) => {
      const next = new Set<string>();
      for (const k of prev) {
        const match = k.match(/^(.+)-(\d+)$/);
        if (!match) { next.add(k); continue; }
        const [, name, idxStr] = match;
        const i = Number(idxStr);
        if (name !== exerciseName) {
          next.add(k);
        } else if (i < setIdx) {
          next.add(k);
        } else if (i > setIdx) {
          next.add(`${name}-${i - 1}`);
        }
      }
      return next;
    });
  }

  function handleNoteChange(exerciseName: string, value: string) {
    setNotes((prev) => ({ ...prev, [exerciseName]: value }));
  }

  function handleDeleteExercise(exerciseName: string) {
    Alert.alert(
      'Remove Exercise',
      `Remove "${exerciseName}" from this workout?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setTemplate((prev: any) => ({
              ...prev,
              exercises: prev.exercises.filter((ex: any) => ex.name !== exerciseName),
            }));
            setEntries((prev) => {
              const updated = { ...prev };
              delete updated[exerciseName];
              return updated;
            });
            setCompletedSets((prev) => {
              const next = new Set<string>();
              for (const key of prev) {
                if (!key.startsWith(exerciseName + '-')) next.add(key);
              }
              return next;
            });
          },
        },
      ],
    );
  }

  async function handleSave() {
    if (!template || template.isRest) return;
    if (saving) return;

    setSaving(true);
    try {
      const oldPbs = JSON.parse(JSON.stringify(pbs));

      const allEntries: any[] = [];
      for (const ex of template.exercises) {
        if (ex.isSectionHeader) continue;
        const exEntries = entries[ex.name] || [];
        ex.sets.forEach((set: any, idx: number) => {
          const key = `${ex.name}-${idx}`;
          allEntries.push({
            exerciseName: ex.name,
            setNumber: set.setNumber,
            weight: exEntries[idx]?.weight || 0,
            reps: exEntries[idx]?.reps || 0,
            isCompleted: completedSets.has(key),
          });
        });
      }

      const workoutData = {
        name: template.name,
        exercises: template.exercises.map((ex: any) => {
          if (ex.isSectionHeader) {
            return { name: ex.name, isSectionHeader: true, sectionNotes: ex.sectionNotes || '', sets: [] };
          }
          return {
            name: ex.name,
            setType: entries[ex.name]?.find((e: any) => e?.setType)?.setType || ex.setType || 'straight',
            sets: ex.sets.map((s: any, i: number) => {
              const entry = entries[ex.name]?.[i];
              return {
                setNumber: s.setNumber,
                plannedReps: s.plannedReps ?? 10,
                suggestedWeight: entry?.weight || s.suggestedWeight || 0,
                setType: entry?.setType || s.setType || ex.setType || 'straight',
              };
            }),
          };
        }),
      };

      await api('/sessions', {
        method: 'POST',
        body: JSON.stringify({
          templateId: Number(templateId),
          date,
          entries: allEntries,
          notes,
          workoutData,
        }),
      });

      // Refresh PBs
      const pbList = await api(`/pbs?templateId=${templateId}`);
      const pbMap: Record<string, Record<string, number>> = {};
      for (const pb of pbList) {
        if (!pbMap[pb.exerciseName]) pbMap[pb.exerciseName] = {};
        pbMap[pb.exerciseName][pb.bestWeight] = pb.bestReps;
      }
      setPbs(pbMap);

      // Detect new PBs
      const improved: any[] = [];
      for (const [exerciseName, newWeights] of Object.entries(pbMap)) {
        const oldWeights = oldPbs[exerciseName] || {};
        for (const [weight, newReps] of Object.entries(newWeights)) {
          const oldReps = oldWeights[weight];
          if (oldReps === undefined || (newReps as number) > oldReps) {
            improved.push({ name: exerciseName, weight: Number(weight), reps: newReps });
          }
        }
      }

      if (improved.length > 0) {
        setNewPBs(improved);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setSaved(true);
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Failed to save workout');
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkComplete() {
    const newCompleted = !isCompleted;
    try {
      if (newCompleted) {
        await handleSave();
      }
      await api('/sessions/complete', {
        method: 'PUT',
        body: JSON.stringify({
          templateId: Number(templateId),
          date,
          completed: newCompleted,
        }),
      });
      setIsCompleted(newCompleted);
      if (newCompleted) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        await clearTimerStorage();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowSummary(true);
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to update: ' + (err.message || 'Unknown error'));
    }
  }

  // ─── Computed values ────────────────────────────────────────────

  const totalSets = template?.exercises
    ?.filter((ex: any) => !ex.isSectionHeader)
    .reduce((sum: number, ex: any) => sum + (ex.sets?.length || 0), 0) || 0;
  const completedCount = completedSets.size;
  const progressPct = totalSets > 0 ? (completedCount / totalSets) * 100 : 0;

  const totalVolume = template?.exercises
    ?.filter((ex: any) => !ex.isSectionHeader)
    .reduce((vol: number, ex: any) => {
      const exEntries = entries[ex.name] || [];
      return vol + exEntries.reduce((sum: number, e: any) => {
        const w = Number(e.weight) || 0;
        const r = Number(e.reps) || 0;
        return sum + w * r;
      }, 0);
    }, 0) || 0;

  const displayDate = date ? format(parseISO(date), 'EEEE, MMM d') : '';
  const inputsLocked = !timerStarted || isCompleted;

  // ─── Rest timer color ───────────────────────────────────────────

  const getRestColor = () => {
    if (restRemaining === null || restRemaining <= 0) return colors.wfGreen;
    const pct = restRemaining / restDuration;
    if (pct > 0.5) return colors.wfGreen;
    if (pct > 0.25) return colors.wfYellow;
    return colors.wfRed;
  };

  // ─── Loading ────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.wfRed} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity
            onPress={() => {
              setLoadError(null);
              setLoading(true);
              // Re-trigger by navigating to same screen
              navigation.replace('WorkoutSession', { templateId, date });
            }}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Tap to Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!template) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Template not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* PB Celebration Modal */}
      <Modal visible={!!newPBs} transparent animationType="fade" onRequestClose={() => setNewPBs(null)}>
        <TouchableOpacity
          style={styles.pbOverlay}
          activeOpacity={1}
          onPress={() => setNewPBs(null)}
        >
          <View style={styles.pbCard}>
            <Text style={styles.pbTrophy}>🏆</Text>
            <Text style={styles.pbTitle}>New PR!</Text>
            {newPBs?.map((pb, i) => (
              <Text key={i} style={styles.pbItem}>
                {pb.name}: {pb.weight} lbs x {pb.reps}
              </Text>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Summary Modal */}
      <Modal visible={showSummary} transparent animationType="slide" onRequestClose={() => setShowSummary(false)}>
        <View style={styles.summaryOverlay}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Workout Complete!</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Time</Text>
              <Text style={styles.summaryValue}>{formatTime(elapsed)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Sets Completed</Text>
              <Text style={styles.summaryValue}>{completedCount}/{totalSets}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Volume</Text>
              <Text style={styles.summaryValue}>{totalVolume.toLocaleString()} lbs</Text>
            </View>

            <TouchableOpacity
              style={styles.summaryDoneButton}
              onPress={() => {
                setShowSummary(false);
                navigation.goBack();
              }}
            >
              <LinearGradient
                colors={[colors.wfRed, colors.wfRedDark]}
                style={styles.summaryDoneGradient}
              >
                <Text style={styles.summaryDoneText}>Done</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back button */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <Text style={styles.headerTitle}>{template.name}</Text>
        <Text style={styles.headerDate}>{displayDate}</Text>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progress</Text>
            <Text style={styles.progressCount}>{completedCount}/{totalSets} sets</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
          </View>
        </View>

        {/* Begin Workout / Timer */}
        {!timerStarted && !isCompleted && (
          <TouchableOpacity onPress={handleBeginWorkout} style={styles.beginButton}>
            <LinearGradient
              colors={[colors.wfRed, colors.wfRedDark]}
              style={styles.beginGradient}
            >
              <Text style={styles.beginText}>Begin Workout</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {timerStarted && (
          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>WORKOUT TIME</Text>
            <Text style={styles.timerDisplay}>{formatTime(elapsed)}</Text>
          </View>
        )}

        {/* Completed banner */}
        {isCompleted && (
          <View style={styles.completedBanner}>
            <Text style={styles.completedText}>Workout Complete</Text>
          </View>
        )}

        {/* Rest Timer */}
        {timerStarted && (
          <View style={styles.restCard}>
            {restRemaining !== null ? (
              restRemaining <= 0 ? (
                <View style={styles.restGoRow}>
                  <View style={styles.restGoBadge}>
                    <Text style={styles.restGoText}>GO!</Text>
                  </View>
                  <TouchableOpacity onPress={stopRestTimer} style={styles.restActionButton}>
                    <Text style={styles.restActionText}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.restActiveRow}>
                  <Text style={styles.restLabel}>REST</Text>
                  <Text style={[styles.restCountdown, { color: getRestColor() }]}>
                    {formatTime(restRemaining)}
                  </Text>
                  <TouchableOpacity onPress={stopRestTimer} style={styles.restActionButton}>
                    <Text style={styles.restActionText}>Skip</Text>
                  </TouchableOpacity>
                </View>
              )
            ) : (
              <TouchableOpacity onPress={startRestTimer} style={styles.startRestButton}>
                <Text style={styles.startRestText}>Start Rest</Text>
              </TouchableOpacity>
            )}

            {/* Rest duration selector */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.restPillsContainer}
              style={styles.restPillsScroll}
            >
              {REST_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setRestDuration(s)}
                  style={[
                    styles.restPill,
                    restDuration === s && styles.restPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.restPillText,
                      restDuration === s && styles.restPillTextActive,
                    ]}
                  >
                    {formatRestLabel(s)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Rest progress bar */}
            {restRemaining !== null && restRemaining > 0 && (
              <View style={styles.restProgressTrack}>
                <View
                  style={[
                    styles.restProgressFill,
                    {
                      width: `${(restRemaining / restDuration) * 100}%` as any,
                      backgroundColor: getRestColor(),
                    },
                  ]}
                />
              </View>
            )}
          </View>
        )}

        {/* Exercise Cards */}
        {template.exercises
          .filter((ex: any) => !ex.isSectionHeader)
          .map((exercise: any, idx: number) => (
            <ExerciseCard
              key={exercise.name}
              exercise={exercise}
              entries={entries[exercise.name] || []}
              completedSets={completedSets}
              pbs={pbs[exercise.name] || {}}
              notes={notes[exercise.name] || ''}
              locked={inputsLocked}
              onChange={handleChange}
              onBlur={handleBlur}
              onToggleComplete={handleToggleComplete}
              onAddSet={handleAddSet}
              onDeleteSet={handleDeleteSet}
              onNoteChange={handleNoteChange}
              onDeleteExercise={handleDeleteExercise}
            />
          ))}

        {/* Spacer for bottom bar */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Fixed Bottom Bar */}
      {template && !template.isRest && (
        <View style={styles.bottomBar}>
          <SafeAreaView edges={['bottom']} style={styles.bottomBarInner}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              style={styles.saveButtonWrapper}
            >
              <LinearGradient
                colors={saved ? [colors.wfGreen, '#16A34A'] : [colors.wfRed, colors.wfRedDark]}
                style={styles.saveButton}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleMarkComplete}
              style={[
                styles.finishButton,
                isCompleted && styles.finishButtonCompleted,
              ]}
            >
              <Text style={[styles.finishButtonText, isCompleted && styles.finishButtonTextCompleted]}>
                {isCompleted ? 'Undo Completion' : 'Finish Workout'}
              </Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  retryText: {
    color: colors.wfCyan,
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  backText: {
    color: colors.wfRed,
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  headerDate: {
    color: colors.gray[400],
    fontSize: 14,
    marginTop: 2,
    marginBottom: 16,
  },

  // Progress bar
  progressContainer: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    color: colors.gray[400],
    fontSize: 12,
    fontWeight: '600',
  },
  progressCount: {
    color: colors.gray[400],
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.wfGreen,
  },

  // Begin workout
  beginButton: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  beginGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  beginText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // Completed banner
  completedBanner: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  completedText: {
    color: colors.wfGreen,
    fontSize: 14,
    fontWeight: '600',
  },

  // Workout timer
  timerCard: {
    backgroundColor: colors.gray[900],
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  timerLabel: {
    color: colors.gray[500],
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 4,
  },
  timerDisplay: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },

  // Rest timer
  restCard: {
    backgroundColor: colors.gray[900],
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  restGoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  restGoBadge: {
    backgroundColor: 'rgba(34,197,94,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  restGoText: {
    color: colors.wfGreen,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  restActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  restLabel: {
    color: colors.gray[500],
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  restCountdown: {
    fontSize: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  restActionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  restActionText: {
    color: colors.gray[500],
    fontSize: 12,
  },
  startRestButton: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  startRestText: {
    color: colors.wfRed,
    fontSize: 13,
    fontWeight: '600',
  },
  restPillsScroll: {
    marginTop: 10,
  },
  restPillsContainer: {
    gap: 6,
  },
  restPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  restPillActive: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: colors.wfRed,
  },
  restPillText: {
    color: colors.gray[400],
    fontSize: 12,
    fontWeight: '600',
  },
  restPillTextActive: {
    color: colors.wfRed,
  },
  restProgressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginTop: 10,
    overflow: 'hidden',
  },
  restProgressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // PB Celebration
  pbOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  pbCard: {
    backgroundColor: '#1C1508',
    borderWidth: 2,
    borderColor: '#D4A017',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  pbTrophy: {
    fontSize: 48,
    marginBottom: 8,
  },
  pbTitle: {
    color: '#F5D060',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 16,
  },
  pbItem: {
    color: '#E8C547',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },

  // Summary Modal
  summaryOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  summaryCard: {
    backgroundColor: colors.gray[900],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  summaryTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  summaryLabel: {
    color: colors.gray[400],
    fontSize: 15,
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  summaryDoneButton: {
    marginTop: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  summaryDoneGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  summaryDoneText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  bottomBarInner: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  saveButtonWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButton: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  finishButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  finishButtonCompleted: {
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  finishButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  finishButtonTextCompleted: {
    color: colors.wfRed,
  },
});
