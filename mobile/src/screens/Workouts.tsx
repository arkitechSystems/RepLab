import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { buildProgramColorMap, getColorFromMap } from '../utils/workoutColors';
import { colors } from '../theme';

// ─── Types ───────────────────────────────────────────────────────────
interface Exercise {
  name: string;
  sets: { weight: number; reps: number }[];
}

interface Template {
  id: number;
  name: string;
  programId: number | null;
  userId: number | null;
  sortOrder: number;
  isRest?: boolean;
  exercises?: Exercise[];
}

interface Program {
  id: number;
  name: string;
  userId: number | null;
}

interface EnrichedProgram extends Program {
  templates: Template[];
  weekCount: number;
  workoutCount: number;
  exerciseCount: number;
  colorMap: Map<string, { hex: string; hexLight: string }>;
}

type ViewState = 'top' | 'group' | 'program' | 'week' | 'preview';

// ─── Component ───────────────────────────────────────────────────────
export default function WorkoutsScreen({ navigation }: any) {
  const { user } = useAuth();

  // Data
  const [programs, setPrograms] = useState<Program[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [streak, setStreak] = useState(0);

  // Navigation state
  const [selectedGroup, setSelectedGroup] = useState<'browse' | 'my' | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<number | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [previewWorkout, setPreviewWorkout] = useState<Template | null>(null);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Derived view state
  const viewState: ViewState = previewWorkout
    ? 'preview'
    : selectedWeek !== null
    ? 'week'
    : selectedProgram !== null
    ? 'program'
    : selectedGroup !== null
    ? 'group'
    : 'top';

  // ─── Data Loading ──────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [progs, tmpls, sessions] = await Promise.all([
        api('/programs'),
        api('/templates'),
        api('/sessions'),
      ]);
      setPrograms(progs);
      setTemplates(tmpls);

      // Calculate streak
      const sessionDates = new Set(
        (sessions || []).map((s: any) => s.date)
      );
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let count = 0;
      const startDay = new Date(today);
      const todayStr = startDay.toISOString().slice(0, 10);
      if (!sessionDates.has(todayStr)) {
        startDay.setDate(startDay.getDate() - 1);
      }
      for (let d = new Date(startDay); ; d.setDate(d.getDate() - 1)) {
        const dateStr = d.toISOString().slice(0, 10);
        if (sessionDates.has(dateStr)) {
          count++;
        } else {
          break;
        }
      }
      setStreak(count);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Failed to load workouts:', err);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // ─── Enriched Programs ────────────────────────────────────────────
  const getEnrichedPrograms = useCallback((): EnrichedProgram[] => {
    return programs.map((p) => {
      const programTemplates = templates
        .filter((t) => t.programId === p.id)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const nonRest = programTemplates.filter((t) => !t.isRest);
      const totalExercises = nonRest.reduce(
        (sum, t) => sum + (t.exercises?.length || 0),
        0
      );
      const colorMap = buildProgramColorMap(programTemplates);
      return {
        ...p,
        templates: programTemplates,
        weekCount: Math.max(1, Math.ceil(programTemplates.length / 7)),
        workoutCount: nonRest.length,
        exerciseCount: totalExercises,
        colorMap,
      };
    });
  }, [programs, templates]);

  const enrichedPrograms = getEnrichedPrograms();
  const browsePrograms = enrichedPrograms
    .filter((p) => p.userId === null)
    .sort((a, b) => {
      if (a.name === "Will's Upper/Lower/PPL") return -1;
      if (b.name === "Will's Upper/Lower/PPL") return 1;
      return 0;
    });
  const myPrograms = enrichedPrograms.filter((p) => p.userId !== null);

  const currentProgram =
    selectedProgram !== null
      ? enrichedPrograms.find((p) => p.id === selectedProgram) || null
      : null;

  // ─── Delete Handlers ──────────────────────────────────────────────
  const handleDeleteProgram = (programId: number) => {
    Alert.alert(
      'Delete Program',
      'Delete this entire program and all its workouts? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api(`/programs/${programId}`, { method: 'DELETE' });
              setPrograms((prev) => prev.filter((p) => p.id !== programId));
              setTemplates((prev) =>
                prev.filter((t) => t.programId !== programId)
              );
              setSelectedProgram(null);
              setSelectedWeek(null);
              setEditMode(false);
            } catch (err) {
              console.error(err);
            }
          },
        },
      ]
    );
  };

  const handleDeleteTemplate = (templateId: number) => {
    Alert.alert(
      'Delete Workout',
      'Delete this workout? This will also remove its history and personal bests.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api(`/templates/${templateId}`, { method: 'DELETE' });
              setTemplates((prev) => prev.filter((t) => t.id !== templateId));
            } catch (err) {
              console.error(err);
            }
          },
        },
      ]
    );
  };

  // ─── Reorder Handlers ─────────────────────────────────────────────
  const handleMoveTemplate = async (
    program: EnrichedProgram,
    idx: number,
    direction: number
  ) => {
    const tmplList = program.templates;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= tmplList.length) return;

    const reordered = [...tmplList];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    const orderedIds = reordered.map((t) => t.id);

    setTemplates((prev) => {
      const updated = [...prev];
      for (let i = 0; i < orderedIds.length; i++) {
        const t = updated.find((u) => u.id === orderedIds[i]);
        if (t) t.sortOrder = i;
      }
      return updated;
    });

    try {
      await api('/templates/reorder', {
        method: 'PUT',
        body: JSON.stringify({ programId: program.id, templateIds: orderedIds }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // ─── Back Navigation ──────────────────────────────────────────────
  const handleBack = () => {
    if (previewWorkout) {
      setPreviewWorkout(null);
    } else if (selectedWeek !== null) {
      setSelectedWeek(null);
    } else if (selectedProgram !== null) {
      setSelectedProgram(null);
      setEditMode(false);
    } else if (selectedGroup !== null) {
      setSelectedGroup(null);
    }
  };

  // ─── Helpers ───────────────────────────────────────────────────────
  const getWeeks = (program: EnrichedProgram) => {
    const weeks: Template[][] = [];
    for (let i = 0; i < program.templates.length; i += 7) {
      weeks.push(program.templates.slice(i, i + 7));
    }
    return weeks;
  };

  // ─── Render: Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.wfRed} />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render: Header ────────────────────────────────────────────────
  const renderHeader = () => {
    if (viewState === 'top') {
      return (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Workouts</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setShowCreateMenu(true)}
          >
            <Text style={styles.createButtonText}>+ Create</Text>
          </TouchableOpacity>
        </View>
      );
    }

    let title = 'Back';
    if (viewState === 'group') {
      title = selectedGroup === 'browse' ? 'Workout Library' : 'My Workouts';
    } else if (viewState === 'program' && currentProgram) {
      title = currentProgram.name;
    } else if (viewState === 'week' && currentProgram) {
      title = `${currentProgram.name} — Week ${(selectedWeek ?? 0) + 1}`;
    } else if (viewState === 'preview' && previewWorkout) {
      title = previewWorkout.name;
    }

    return (
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitleSmall} numberOfLines={1}>
          {title}
        </Text>
        {viewState === 'group' && selectedGroup === 'my' && (
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setShowCreateMenu(true)}
          >
            <Text style={styles.createButtonText}>+</Text>
          </TouchableOpacity>
        )}
        {(viewState === 'program' || viewState === 'week') &&
          currentProgram?.userId !== null && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setEditMode((prev) => !prev)}
            >
              <Text style={styles.editButtonText}>
                {editMode ? 'Done' : 'Edit'}
              </Text>
            </TouchableOpacity>
          )}
      </View>
    );
  };

  // ─── Render: Top Level ─────────────────────────────────────────────
  const renderTopLevel = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.wfRed}
        />
      }
    >
      {/* Streak Card */}
      {streak > 0 && (
        <LinearGradient
          colors={['rgba(239,68,68,0.15)', 'rgba(249,115,22,0.1)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.streakCard}
        >
          <Text style={styles.streakEmoji}>🔥</Text>
          <View>
            <Text style={styles.streakTitle}>{streak} Day Streak!</Text>
            <Text style={styles.streakSub}>Keep the momentum going</Text>
          </View>
        </LinearGradient>
      )}

      {/* Browse Library Card */}
      <TouchableOpacity
        style={styles.glassCard}
        onPress={() => setSelectedGroup('browse')}
        activeOpacity={0.7}
      >
        <View style={styles.cardRow}>
          <View style={styles.cardIconContainer}>
            <Text style={styles.cardIcon}>📚</Text>
          </View>
          <View style={styles.cardTextContainer}>
            <Text style={styles.cardTitle}>Browse Workout Library</Text>
            <Text style={styles.cardSubtitle}>
              {browsePrograms.length} program{browsePrograms.length !== 1 ? 's' : ''} available
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
      </TouchableOpacity>

      {/* My Workouts Card */}
      <TouchableOpacity
        style={styles.glassCard}
        onPress={() => setSelectedGroup('my')}
        activeOpacity={0.7}
      >
        <View style={styles.cardRow}>
          <View style={styles.cardIconContainer}>
            <Text style={styles.cardIcon}>💪</Text>
          </View>
          <View style={styles.cardTextContainer}>
            <Text style={styles.cardTitle}>My Workouts</Text>
            <Text style={styles.cardSubtitle}>
              {myPrograms.length} program{myPrograms.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );

  // ─── Render: Program Card ─────────────────────────────────────────
  const renderProgramCard = (program: EnrichedProgram, showDelete: boolean) => {
    const colorEntries = [...program.colorMap.entries()];
    const colorValues = [...program.colorMap.values()];

    return (
      <TouchableOpacity
        key={program.id}
        style={styles.glassCard}
        onPress={() => {
          setSelectedProgram(program.id);
          // Auto-select week 0 if only one week
          if (program.weekCount === 1) {
            setSelectedWeek(0);
          }
        }}
        activeOpacity={0.7}
      >
        {/* Color strip at top */}
        {colorValues.length > 0 && (
          <View style={styles.colorStrip}>
            {colorValues.map((c, i) => (
              <View
                key={i}
                style={[styles.colorStripSegment, { backgroundColor: c.hex }]}
              />
            ))}
          </View>
        )}

        <View style={styles.programCardContent}>
          <View style={styles.programCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.programName}>{program.name}</Text>
              <Text style={styles.programMeta}>
                {program.weekCount} {program.weekCount === 1 ? 'week' : 'weeks'} · {program.workoutCount} workouts
              </Text>
            </View>
            {showDelete && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteProgram(program.id)}
              >
                <Text style={styles.deleteButtonText}>🗑</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Color dots with labels */}
          {colorEntries.length > 0 && (
            <View style={styles.colorDotsRow}>
              {colorEntries.map(([name, color]) => (
                <View key={name} style={styles.colorDotItem}>
                  <View
                    style={[styles.colorDot, { backgroundColor: color.hex }]}
                  />
                  <Text style={styles.colorDotLabel}>{name}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.viewHint}>
            <Text style={styles.viewHintText}>View workouts</Text>
            <Text style={styles.chevronSmall}>›</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Render: Group List ────────────────────────────────────────────
  const renderGroupList = () => {
    const list = selectedGroup === 'browse' ? browsePrograms : myPrograms;
    const showDelete = selectedGroup === 'my';

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {list.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>
              {selectedGroup === 'my'
                ? 'No programs yet'
                : 'No programs available'}
            </Text>
            <Text style={styles.emptySub}>
              {selectedGroup === 'my'
                ? 'Create your first program to get started'
                : 'Check back later for new programs'}
            </Text>
            {selectedGroup === 'my' && (
              <TouchableOpacity
                style={styles.emptyCreateButton}
                onPress={() => setShowCreateMenu(true)}
              >
                <Text style={styles.emptyCreateText}>+ Create Program</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          list.map((p) => renderProgramCard(p, showDelete))
        )}
      </ScrollView>
    );
  };

  // ─── Render: Program Detail (Weeks) ────────────────────────────────
  const renderProgramDetail = () => {
    if (!currentProgram) return null;
    const weeks = getWeeks(currentProgram);

    if (weeks.length <= 1) {
      // Auto-navigate to week 0 already handled, but as fallback:
      return renderWeekDetail();
    }

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {weeks.map((weekTemplates, weekIdx) => {
          const nonRest = weekTemplates.filter((t) => !t.isRest);
          const weekColorMap = buildProgramColorMap(weekTemplates);
          const colorValues = [...weekColorMap.values()];

          return (
            <TouchableOpacity
              key={weekIdx}
              style={styles.glassCard}
              onPress={() => setSelectedWeek(weekIdx)}
              activeOpacity={0.7}
            >
              <View style={styles.weekCardContent}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.weekTitle}>Week {weekIdx + 1}</Text>
                  <Text style={styles.weekMeta}>
                    {nonRest.length} workout{nonRest.length !== 1 ? 's' : ''} · {weekTemplates.length} days
                  </Text>
                </View>

                {/* Mini color dots */}
                <View style={styles.miniDotsRow}>
                  {colorValues.map((c, i) => (
                    <View
                      key={i}
                      style={[styles.miniDot, { backgroundColor: c.hex }]}
                    />
                  ))}
                </View>

                <Text style={styles.chevron}>›</Text>
              </View>

              {editMode && currentProgram.userId !== null && (
                <TouchableOpacity
                  style={styles.deleteWeekButton}
                  onPress={() => {
                    Alert.alert(
                      'Delete Week',
                      `Delete Week ${weekIdx + 1} and all its workouts? This cannot be undone.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              for (const t of weekTemplates) {
                                await api(`/templates/${t.id}`, { method: 'DELETE' });
                              }
                              const deletedIds = new Set(weekTemplates.map((t) => t.id));
                              setTemplates((prev) =>
                                prev.filter((t) => !deletedIds.has(t.id))
                              );
                            } catch (err) {
                              console.error(err);
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Text style={styles.deleteWeekText}>Delete Week</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  // ─── Render: Week Detail (Templates) ───────────────────────────────
  const renderWeekDetail = () => {
    if (!currentProgram) return null;
    const weeks = getWeeks(currentProgram);
    const weekIdx = selectedWeek ?? 0;
    const weekTemplates = weeks[weekIdx] || [];
    const colorMap = currentProgram.colorMap;

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {weekTemplates.map((template, idx) => {
          const color = getColorFromMap(colorMap, template.name, template.isRest);
          const exerciseCount = template.exercises?.length || 0;

          return (
            <View key={template.id} style={styles.templateCardWrapper}>
              {/* Edit mode controls */}
              {editMode && currentProgram.userId !== null && (
                <View style={styles.editControls}>
                  <TouchableOpacity
                    style={[
                      styles.arrowButton,
                      idx === 0 && styles.arrowDisabled,
                    ]}
                    onPress={() =>
                      handleMoveTemplate(currentProgram, idx, -1)
                    }
                    disabled={idx === 0}
                  >
                    <Text style={styles.arrowText}>▲</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.arrowButton,
                      idx === weekTemplates.length - 1 && styles.arrowDisabled,
                    ]}
                    onPress={() =>
                      handleMoveTemplate(currentProgram, idx, 1)
                    }
                    disabled={idx === weekTemplates.length - 1}
                  >
                    <Text style={styles.arrowText}>▼</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.templateCard,
                  { borderLeftColor: color.hex, borderLeftWidth: 4 },
                ]}
                onPress={() => setPreviewWorkout(template)}
                activeOpacity={0.7}
              >
                <View style={styles.templateCardBody}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.templateName}>{template.name}</Text>
                    <Text style={styles.templateMeta}>
                      {template.isRest
                        ? 'Rest Day'
                        : `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}`}
                    </Text>
                  </View>

                  <View style={styles.templateActions}>
                    {currentProgram.userId !== null && (
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() =>
                          navigation.navigate('EditWorkout', { id: template.id })
                        }
                      >
                        <Text style={styles.iconButtonText}>✏️</Text>
                      </TouchableOpacity>
                    )}
                    {editMode && currentProgram.userId !== null && (
                      <TouchableOpacity
                        style={styles.iconButtonDanger}
                        onPress={() => handleDeleteTemplate(template.id)}
                      >
                        <Text style={styles.iconButtonText}>🗑</Text>
                      </TouchableOpacity>
                    )}
                    {!editMode && (
                      <Text style={styles.chevronSmall}>›</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Add workout button in edit mode */}
        {editMode && currentProgram.userId !== null && (
          <TouchableOpacity
            style={styles.addWorkoutButton}
            onPress={() =>
              navigation.navigate('CreateWorkout', {
                programId: currentProgram.id,
              })
            }
          >
            <Text style={styles.addWorkoutText}>+ Add Workout</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };

  // ─── Render: Workout Preview ───────────────────────────────────────
  const renderWorkoutPreview = () => {
    if (!previewWorkout) return null;
    const exercises = previewWorkout.exercises || [];

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {previewWorkout.isRest ? (
          <View style={styles.restDayCard}>
            <Text style={styles.restDayEmoji}>😴</Text>
            <Text style={styles.restDayText}>Rest Day</Text>
            <Text style={styles.restDaySub}>
              Recovery is just as important as training
            </Text>
          </View>
        ) : exercises.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No exercises</Text>
            <Text style={styles.emptySub}>
              This workout doesn't have any exercises yet
            </Text>
          </View>
        ) : (
          exercises.map((exercise, exIdx) => (
            <View key={exIdx} style={styles.exerciseCard}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              {exercise.sets && exercise.sets.length > 0 && (
                <View style={styles.setsTable}>
                  {/* Table header */}
                  <View style={styles.setsHeaderRow}>
                    <Text style={[styles.setsHeaderCell, styles.setNumCol]}>Set</Text>
                    <Text style={[styles.setsHeaderCell, styles.setDataCol]}>Weight</Text>
                    <Text style={[styles.setsHeaderCell, styles.setDataCol]}>Reps</Text>
                  </View>
                  {exercise.sets.map((set, setIdx) => (
                    <View key={setIdx} style={styles.setsRow}>
                      <Text style={[styles.setsCell, styles.setNumCol]}>
                        {setIdx + 1}
                      </Text>
                      <Text style={[styles.setsCell, styles.setDataCol]}>
                        {set.weight > 0 ? `${set.weight} lbs` : '—'}
                      </Text>
                      <Text style={[styles.setsCell, styles.setDataCol]}>
                        {set.reps > 0 ? set.reps : '—'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  // ─── Render: Create Menu Modal ─────────────────────────────────────
  const renderCreateMenu = () => (
    <Modal
      visible={showCreateMenu}
      transparent
      animationType="fade"
      onRequestClose={() => setShowCreateMenu(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowCreateMenu(false)}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Create</Text>

          <TouchableOpacity
            style={styles.modalOption}
            onPress={() => {
              setShowCreateMenu(false);
              navigation.navigate('CreateWorkout', { quick: true });
            }}
          >
            <Text style={styles.modalOptionIcon}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalOptionTitle}>Quick Create</Text>
              <Text style={styles.modalOptionSub}>
                Create a standalone workout
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modalOption}
            onPress={() => {
              setShowCreateMenu(false);
              navigation.navigate('CreateProgram');
            }}
          >
            <Text style={styles.modalOptionIcon}>📋</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalOptionTitle}>New Program</Text>
              <Text style={styles.modalOptionSub}>
                Create a multi-week program
              </Text>
            </View>
          </TouchableOpacity>

          {myPrograms.length > 0 && (
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setShowCreateMenu(false);
                // If there's a selected program, use it
                const targetProgram = selectedProgram || myPrograms[0]?.id;
                if (targetProgram) {
                  navigation.navigate('CreateWorkout', {
                    programId: targetProgram,
                  });
                }
              }}
            >
              <Text style={styles.modalOptionIcon}>➕</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalOptionTitle}>Add to Program</Text>
                <Text style={styles.modalOptionSub}>
                  Add a workout to an existing program
                </Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.modalCancel}
            onPress={() => setShowCreateMenu(false)}
          >
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // ─── Main Render ───────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}

      {viewState === 'top' && renderTopLevel()}
      {viewState === 'group' && renderGroupList()}
      {viewState === 'program' && renderProgramDetail()}
      {viewState === 'week' && renderWeekDetail()}
      {viewState === 'preview' && renderWorkoutPreview()}

      {renderCreateMenu()}
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerTitleSmall: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  backArrow: {
    fontSize: 28,
    color: colors.wfRed,
    marginRight: 2,
    marginTop: -2,
  },
  backText: {
    fontSize: 16,
    color: colors.wfRed,
  },
  createButton: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  createButtonText: {
    color: colors.wfRed,
    fontSize: 14,
    fontWeight: '700',
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editButtonText: {
    color: colors.wfRed,
    fontSize: 15,
    fontWeight: '600',
  },

  // Streak Card
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    marginBottom: 16,
  },
  streakEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  streakTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  streakSub: {
    fontSize: 13,
    color: colors.gray[400],
    marginTop: 2,
  },

  // Glass Card
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },

  // Category cards (top level)
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardIcon: {
    fontSize: 22,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.gray[400],
    marginTop: 3,
  },
  chevron: {
    fontSize: 24,
    color: colors.gray[500],
    marginLeft: 8,
  },

  // Color strip
  colorStrip: {
    flexDirection: 'row',
    height: 5,
  },
  colorStripSegment: {
    flex: 1,
  },

  // Program card
  programCardContent: {
    padding: 16,
  },
  programCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  programName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  programMeta: {
    fontSize: 13,
    color: colors.gray[400],
    marginTop: 4,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  deleteButtonText: {
    fontSize: 16,
  },

  // Color dots
  colorDotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  colorDotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  colorDotLabel: {
    fontSize: 11,
    color: colors.gray[400],
    fontWeight: '500',
    textTransform: 'capitalize',
  },

  // View hint
  viewHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  viewHintText: {
    fontSize: 12,
    color: colors.gray[500],
    marginRight: 2,
  },
  chevronSmall: {
    fontSize: 18,
    color: colors.gray[500],
  },

  // Week card
  weekCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  weekTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  weekMeta: {
    fontSize: 13,
    color: colors.gray[400],
    marginTop: 3,
  },
  miniDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 12,
  },
  miniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deleteWeekButton: {
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
    padding: 10,
    alignItems: 'center',
  },
  deleteWeekText: {
    color: colors.wfRed,
    fontSize: 13,
    fontWeight: '600',
  },

  // Template card
  templateCardWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  editControls: {
    marginRight: 8,
    gap: 4,
  },
  arrowButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowDisabled: {
    opacity: 0.3,
  },
  arrowText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  templateCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  templateCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  templateMeta: {
    fontSize: 13,
    color: colors.gray[400],
    marginTop: 3,
  },
  templateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDanger: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: {
    fontSize: 14,
  },
  addWorkoutButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  addWorkoutText: {
    color: colors.gray[400],
    fontSize: 14,
    fontWeight: '600',
  },

  // Exercise preview
  exerciseCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  setsTable: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  setsHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  setsHeaderCell: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  setsRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  setsCell: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  setNumCol: {
    width: 40,
  },
  setDataCol: {
    flex: 1,
    textAlign: 'center',
  },

  // Rest day
  restDayCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
  },
  restDayEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  restDayText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  restDaySub: {
    fontSize: 14,
    color: colors.gray[400],
    marginTop: 6,
    textAlign: 'center',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptySub: {
    fontSize: 14,
    color: colors.gray[400],
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  emptyCreateButton: {
    marginTop: 20,
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyCreateText: {
    color: colors.wfRed,
    fontSize: 15,
    fontWeight: '700',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.gray[900],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    marginBottom: 10,
    gap: 14,
  },
  modalOptionIcon: {
    fontSize: 24,
  },
  modalOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOptionSub: {
    fontSize: 13,
    color: colors.gray[400],
    marginTop: 2,
  },
  modalCancel: {
    padding: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  modalCancelText: {
    color: colors.gray[400],
    fontSize: 16,
    fontWeight: '600',
  },
});
