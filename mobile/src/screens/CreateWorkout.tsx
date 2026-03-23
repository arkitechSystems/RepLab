import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, FlatList,
  KeyboardAvoidingView, ScrollView, Platform, ActivityIndicator,
  Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from '../api';
import { useExercises } from '../hooks/useExercises';

const SET_TYPES = ['straight', 'drop', 'rest_pause', 'superset', 'warm_up', 'touch_up'];

const SET_TYPE_LABELS: Record<string, string> = {
  straight: 'Straight',
  drop: 'Drop',
  rest_pause: 'Rest-Pause',
  superset: 'Superset',
  warm_up: 'Warm Up',
  touch_up: 'Touch Up',
};

interface TemplateExercise {
  name: string;
  setType: string;
  sets: { reps: number; weight: number }[];
}

interface Program {
  id: number;
  name: string;
}

export default function CreateWorkout() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params || {}) as { programId?: number; quick?: boolean };

  const { exercises: allExercises, loading: exercisesLoading } = useExercises();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(params.programId ?? null);
  const [programPickerVisible, setProgramPickerVisible] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateExercises, setTemplateExercises] = useState<TemplateExercise[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Autocomplete state
  const [autocompleteVisible, setAutocompleteVisible] = useState(false);
  const [autocompleteIdx, setAutocompleteIdx] = useState<number>(-1);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');

  // Load programs
  useEffect(() => {
    api('/programs')
      .then((data: Program[]) => {
        setPrograms(data);
        if (params.quick) {
          handleQuickCreate(data);
        }
      })
      .catch(console.error);
  }, []);

  async function handleQuickCreate(existingPrograms: Program[]) {
    const myWorkouts = existingPrograms.find(
      (p) => p.name.toLowerCase() === 'my workouts'
    );
    if (myWorkouts) {
      setSelectedProgramId(myWorkouts.id);
    } else {
      try {
        const created = await api('/programs', {
          method: 'POST',
          body: JSON.stringify({ name: 'My Workouts' }),
        });
        setPrograms((prev) => [...prev, created]);
        setSelectedProgramId(created.id);
      } catch (err: any) {
        console.error('Failed to create My Workouts program', err);
      }
    }
  }

  // Exercise helpers
  const addExercise = useCallback(() => {
    setTemplateExercises((prev) => [
      ...prev,
      { name: '', setType: 'straight', sets: [{ reps: 0, weight: 0 }] },
    ]);
  }, []);

  const removeExercise = useCallback((idx: number) => {
    setTemplateExercises((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateExercise = useCallback(
    (idx: number, field: keyof TemplateExercise, value: any) => {
      setTemplateExercises((prev) =>
        prev.map((ex, i) => (i === idx ? { ...ex, [field]: value } : ex))
      );
    },
    []
  );

  const addSet = useCallback((exIdx: number) => {
    setTemplateExercises((prev) =>
      prev.map((ex, i) =>
        i === exIdx ? { ...ex, sets: [...ex.sets, { reps: 0, weight: 0 }] } : ex
      )
    );
  }, []);

  const updateSet = useCallback(
    (exIdx: number, setIdx: number, field: 'reps' | 'weight', value: number) => {
      setTemplateExercises((prev) =>
        prev.map((ex, i) =>
          i === exIdx
            ? {
                ...ex,
                sets: ex.sets.map((s, si) =>
                  si === setIdx ? { ...s, [field]: value } : s
                ),
              }
            : ex
        )
      );
    },
    []
  );

  const removeSet = useCallback((exIdx: number, setIdx: number) => {
    setTemplateExercises((prev) =>
      prev.map((ex, i) =>
        i === exIdx
          ? { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx) }
          : ex
      )
    );
  }, []);

  // Autocomplete
  const openAutocomplete = (idx: number) => {
    setAutocompleteIdx(idx);
    setAutocompleteQuery(templateExercises[idx]?.name || '');
    setAutocompleteVisible(true);
  };

  const getFilteredExercises = () => {
    if (!autocompleteQuery.trim()) return [];
    const q = autocompleteQuery.toLowerCase();
    return allExercises
      .filter((e) => e.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  };

  const selectExercise = (exerciseName: string) => {
    updateExercise(autocompleteIdx, 'name', exerciseName);
    setAutocompleteVisible(false);
  };

  // Save
  async function handleSave() {
    setError('');
    if (!name.trim()) {
      setError('Workout name is required');
      return;
    }
    if (!selectedProgramId) {
      setError('Please select a program');
      return;
    }
    if (templateExercises.length === 0) {
      setError('Add at least one exercise');
      return;
    }
    const hasEmptyName = templateExercises.some((ex) => !ex.name.trim());
    if (hasEmptyName) {
      setError('All exercises must have a name');
      return;
    }

    setSaving(true);
    try {
      await api('/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          exercises: templateExercises,
          programId: selectedProgramId,
        }),
      });
      navigation.goBack();
    } catch (err: any) {
      setError(err.message || 'Failed to create workout');
    } finally {
      setSaving(false);
    }
  }

  const selectedProgram = programs.find((p) => p.id === selectedProgramId);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>{'< Back'}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Create Workout</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Error */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Program Picker */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>PROGRAM</Text>
            <Pressable
              style={styles.input}
              onPress={() => setProgramPickerVisible(true)}
            >
              <Text style={selectedProgram ? styles.inputText : styles.placeholderText}>
                {selectedProgram?.name || 'Select a program'}
              </Text>
            </Pressable>
          </View>

          {/* Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>WORKOUT NAME</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Push Day A"
              placeholderTextColor="#555555"
            />
          </View>

          {/* Description */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>DESCRIPTION</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional description"
              placeholderTextColor="#555555"
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Exercises */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>EXERCISES</Text>
            <Pressable onPress={addExercise} style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Add Exercise</Text>
            </Pressable>
          </View>

          {templateExercises.map((exercise, exIdx) => (
            <View key={exIdx} style={styles.exerciseCard}>
              {/* Exercise Name */}
              <View style={styles.exerciseHeader}>
                <Pressable
                  style={styles.exerciseNameButton}
                  onPress={() => openAutocomplete(exIdx)}
                >
                  <Text
                    style={
                      exercise.name ? styles.exerciseName : styles.exerciseNamePlaceholder
                    }
                  >
                    {exercise.name || 'Tap to select exercise'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => removeExercise(exIdx)} style={styles.removeExButton}>
                  <Text style={styles.removeExText}>Remove</Text>
                </Pressable>
              </View>

              {/* Set Type Selector */}
              <Text style={styles.label}>SET TYPE</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.setTypeRow}
              >
                {SET_TYPES.map((st) => (
                  <Pressable
                    key={st}
                    style={[
                      styles.setTypeChip,
                      exercise.setType === st && styles.setTypeChipActive,
                    ]}
                    onPress={() => updateExercise(exIdx, 'setType', st)}
                  >
                    <Text
                      style={[
                        styles.setTypeChipText,
                        exercise.setType === st && styles.setTypeChipTextActive,
                      ]}
                    >
                      {SET_TYPE_LABELS[st]}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Sets Table */}
              <View style={styles.setsTable}>
                <View style={styles.setsTableHeader}>
                  <Text style={[styles.setsHeaderText, styles.setNumCol]}>Set</Text>
                  <Text style={[styles.setsHeaderText, styles.setValCol]}>Weight</Text>
                  <Text style={[styles.setsHeaderText, styles.setValCol]}>Reps</Text>
                  <View style={styles.setRemoveCol} />
                </View>
                {exercise.sets.map((set, setIdx) => (
                  <View key={setIdx} style={styles.setRow}>
                    <Text style={[styles.setNumText, styles.setNumCol]}>{setIdx + 1}</Text>
                    <TextInput
                      style={[styles.setInput, styles.setValCol]}
                      value={set.weight ? String(set.weight) : ''}
                      onChangeText={(v) =>
                        updateSet(exIdx, setIdx, 'weight', parseFloat(v) || 0)
                      }
                      placeholder="0"
                      placeholderTextColor="#555555"
                      keyboardType="numeric"
                    />
                    <TextInput
                      style={[styles.setInput, styles.setValCol]}
                      value={set.reps ? String(set.reps) : ''}
                      onChangeText={(v) =>
                        updateSet(exIdx, setIdx, 'reps', parseInt(v, 10) || 0)
                      }
                      placeholder="0"
                      placeholderTextColor="#555555"
                      keyboardType="numeric"
                    />
                    <Pressable
                      style={styles.setRemoveCol}
                      onPress={() => removeSet(exIdx, setIdx)}
                    >
                      <Text style={styles.setRemoveText}>X</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
              <Pressable onPress={() => addSet(exIdx)} style={styles.addSetButton}>
                <Text style={styles.addSetText}>+ Add Set</Text>
              </Pressable>
            </View>
          ))}

          {/* Bottom spacer for fixed button */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Fixed Save Button */}
        <View style={styles.fixedBottom}>
          <Pressable onPress={handleSave} disabled={saving}>
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.saveButton, saving && styles.buttonDisabled]}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Create Workout</Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Program Picker Modal */}
      <Modal visible={programPickerVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Program</Text>
              <Pressable onPress={() => setProgramPickerVisible(false)}>
                <Text style={styles.modalClose}>Done</Text>
              </Pressable>
            </View>
            <FlatList
              data={programs}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.modalItem,
                    item.id === selectedProgramId && styles.modalItemActive,
                  ]}
                  onPress={() => {
                    setSelectedProgramId(item.id);
                    setProgramPickerVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      item.id === selectedProgramId && styles.modalItemTextActive,
                    ]}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No programs found</Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Exercise Autocomplete Modal */}
      <Modal visible={autocompleteVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Exercise</Text>
              <Pressable onPress={() => setAutocompleteVisible(false)}>
                <Text style={styles.modalClose}>Cancel</Text>
              </Pressable>
            </View>
            <TextInput
              style={[styles.input, { margin: 16 }]}
              value={autocompleteQuery}
              onChangeText={setAutocompleteQuery}
              placeholder="Search exercises..."
              placeholderTextColor="#555555"
              autoFocus
            />
            <FlatList
              data={getFilteredExercises()}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalItem}
                  onPress={() => selectExercise(item.name)}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                  <Text style={styles.muscleGroupText}>{item.muscle}</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                autocompleteQuery.trim() ? (
                  <Text style={styles.emptyText}>No exercises found</Text>
                ) : (
                  <Text style={styles.emptyText}>Type to search</Text>
                )
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backButton: { width: 70 },
  backText: { color: '#EF4444', fontSize: 16 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  headerSpacer: { width: 70 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  errorBox: {
    backgroundColor: 'rgba(127,29,29,0.3)',
    borderWidth: 1,
    borderColor: '#991B1B',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  errorText: { color: '#FCA5A5', fontSize: 14 },
  fieldGroup: { marginBottom: 16 },
  label: {
    color: '#888888',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 16,
  },
  inputText: { color: '#FFFFFF', fontSize: 16 },
  placeholderText: { color: '#555555', fontSize: 16 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    color: '#888888',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  addButton: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addButtonText: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
  exerciseCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseNameButton: { flex: 1, marginRight: 12 },
  exerciseName: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  exerciseNamePlaceholder: { color: '#555555', fontSize: 16 },
  removeExButton: {
    backgroundColor: 'rgba(127,29,29,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  removeExText: { color: '#FCA5A5', fontSize: 12, fontWeight: '600' },
  setTypeRow: { flexDirection: 'row', marginBottom: 12 },
  setTypeChip: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  setTypeChipActive: { backgroundColor: 'rgba(239,68,68,0.2)' },
  setTypeChipText: { color: '#888888', fontSize: 12, fontWeight: '500' },
  setTypeChipTextActive: { color: '#EF4444' },
  setsTable: { marginBottom: 8 },
  setsTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  setsHeaderText: {
    color: '#888888',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  setNumCol: { width: 40, textAlign: 'center' },
  setValCol: { flex: 1, marginHorizontal: 4 },
  setRemoveCol: { width: 30, alignItems: 'center' },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  setNumText: { color: '#FFFFFF', fontSize: 14, textAlign: 'center' },
  setInput: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
  setRemoveText: { color: '#FCA5A5', fontSize: 14, fontWeight: '600' },
  addSetButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  addSetText: { color: '#EF4444', fontSize: 13, fontWeight: '500' },
  fixedBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  modalClose: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  modalItemActive: { backgroundColor: 'rgba(239,68,68,0.1)' },
  modalItemText: { color: '#FFFFFF', fontSize: 16 },
  modalItemTextActive: { color: '#EF4444', fontWeight: '600' },
  muscleGroupText: { color: '#888888', fontSize: 13 },
  emptyText: { color: '#555555', fontSize: 14, textAlign: 'center', padding: 24 },
});
