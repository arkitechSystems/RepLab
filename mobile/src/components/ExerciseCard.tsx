import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  Alert,
  StyleSheet,
} from 'react-native';

// ─── Set Types ───────────────────────────────────────────────
const SET_TYPES = [
  { value: 'warm_up', short: 'WU', label: 'Warm Up' },
  { value: 'touch_up', short: 'TU', label: 'Touch Up' },
  { value: 'straight', short: 'REG', label: 'Regular' },
  { value: 'drop', short: 'DS', label: 'Drop Set' },
  { value: 'rest_pause', short: 'RP', label: 'Rest-Pause' },
  { value: 'superset', short: 'SS', label: 'Super Set' },
];

function getSetTypeShort(value: string): string {
  return SET_TYPES.find((t) => t.value === value)?.short || 'REG';
}

export { SET_TYPES };

// ─── Props ───────────────────────────────────────────────────
interface ExerciseCardProps {
  exercise: { name: string; setType?: string; sets: any[] };
  entries?: { weight: any; reps: any; setType?: string }[];
  pbs?: Record<string, Record<number, number>>;
  onChange?: (exerciseName: string, setIdx: number, field: string, value: any) => void;
  onBlur?: (exerciseName: string, setIdx: number, field: string) => void;
  readOnly?: boolean;
  completedSets?: Set<string>;
  autoFilled?: Set<string>;
  onToggleComplete?: (exerciseName: string, setIdx: number) => void;
  onAddSet?: (exerciseName: string) => void;
  onDeleteSet?: (exerciseName: string, setIdx: number) => void;
  onSwapExercise?: (oldName: string, newName: string) => void;
  onAddExercise?: (name: string) => void;
  onDeleteExercise?: () => void;
  onMoveUp?: (() => void) | null;
  onMoveDown?: (() => void) | null;
  note?: string;
  onNoteChange?: (exerciseName: string, value: string) => void;
  mode?: 'session' | 'template';
}

// ─── Component ───────────────────────────────────────────────
function ExerciseCard({
  exercise,
  entries,
  pbs,
  onChange,
  onBlur,
  readOnly,
  completedSets,
  autoFilled,
  onToggleComplete,
  onAddSet,
  onDeleteSet,
  onSwapExercise,
  onAddExercise,
  onDeleteExercise,
  onMoveUp,
  onMoveDown,
  note,
  onNoteChange,
  mode = 'session',
}: ExerciseCardProps) {
  const isTemplate = mode === 'template';
  const [typePickerIdx, setTypePickerIdx] = useState<number | null>(null);
  const [showNoteInput, setShowNoteInput] = useState(!!note);

  // ── Long-press delete set ──
  const handleLongPressSet = useCallback(
    (idx: number) => {
      if (readOnly || !onDeleteSet || exercise.sets.length <= 1) return;
      Alert.alert(
        'Delete Set',
        `Remove set ${idx + 1} from ${exercise.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => onDeleteSet(exercise.name, idx),
          },
        ],
      );
    },
    [readOnly, onDeleteSet, exercise.name, exercise.sets.length],
  );

  // ── Remove last set (from subheader) ──
  const handleRemoveLastSet = useCallback(() => {
    if (!onDeleteSet) return;
    const lastIdx = exercise.sets.length - 1;
    const lastKey = `${exercise.name}-${lastIdx}`;
    if (completedSets?.has(lastKey)) {
      Alert.alert(
        'Delete Completed Set',
        'This set is marked complete. Remove it anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => onDeleteSet(exercise.name, lastIdx),
          },
        ],
      );
    } else {
      onDeleteSet(exercise.name, lastIdx);
    }
  }, [onDeleteSet, exercise.name, exercise.sets.length, completedSets]);

  // ── Set type selected ──
  const handleSetTypeSelect = useCallback(
    (value: string) => {
      if (typePickerIdx !== null) {
        onChange?.(exercise.name, typePickerIdx, 'setType', value);
        setTypePickerIdx(null);
      }
    },
    [typePickerIdx, onChange, exercise.name],
  );

  // ── Helpers for determining whether a column shows ──
  const showCheckCol = !isTemplate && !readOnly && !!onToggleComplete;

  return (
    <View style={styles.card}>
      {/* ───── Header Row ───── */}
      <View style={styles.header}>
        <Text style={styles.exerciseName} numberOfLines={2}>
          {exercise.name}
        </Text>

        {!readOnly && (
          <View style={styles.headerActions}>
            {onMoveUp && (
              <Pressable onPress={onMoveUp} style={styles.actionBtn}>
                <Text style={styles.actionIcon}>{'\u25B2'}</Text>
              </Pressable>
            )}
            {onMoveDown && (
              <Pressable onPress={onMoveDown} style={styles.actionBtn}>
                <Text style={styles.actionIcon}>{'\u25BC'}</Text>
              </Pressable>
            )}
            {onSwapExercise && (
              <Pressable
                onPress={() => {
                  /* swap modal handled externally */
                }}
                style={styles.actionBtn}
              >
                <Text style={[styles.actionIcon, { color: '#60A5FA' }]}>{'\u21C4'}</Text>
              </Pressable>
            )}
            {onAddExercise && (
              <Pressable
                onPress={() => {
                  /* add-below modal handled externally */
                }}
                style={styles.actionBtn}
              >
                <Text style={[styles.actionIcon, { color: '#4ADE80' }]}>+</Text>
              </Pressable>
            )}
            {onDeleteExercise && (
              <Pressable onPress={onDeleteExercise} style={styles.actionBtn}>
                <Text style={[styles.actionIcon, { color: '#F87171' }]}>{'\u2715'}</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* ───── Set Controls Subheader ───── */}
      {!readOnly && onAddSet && (
        <View style={styles.subheader}>
          <Text style={styles.setCount}>
            {exercise.sets.length} SET{exercise.sets.length !== 1 ? 'S' : ''}
          </Text>
          <View style={styles.subheaderBtns}>
            <Pressable
              onPress={() => onAddSet(exercise.name)}
              style={styles.subheaderBtn}
            >
              <Text style={styles.subheaderBtnPlus}>+</Text>
              <Text style={styles.subheaderBtnText}>ADD SET</Text>
            </Pressable>
            {onDeleteSet && exercise.sets.length > 1 && (
              <Pressable onPress={handleRemoveLastSet} style={styles.subheaderBtnRemove}>
                <Text style={styles.subheaderBtnMinus}>{'\u2212'}</Text>
                <Text style={styles.subheaderBtnTextRemove}>REMOVE</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* ───── Column Headers ───── */}
      <View style={styles.colHeaderRow}>
        {showCheckCol && <View style={{ width: 28 }} />}
        <View style={{ width: 32, alignItems: 'center' }}>
          <Text style={styles.colHeader}>SET</Text>
        </View>
        <View style={{ width: 56, alignItems: 'center' }}>
          <Text style={styles.colHeader}>TYPE</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.colHeader}>WEIGHT</Text>
        </View>
        {isTemplate ? (
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.colHeader}>REPS</Text>
          </View>
        ) : (
          <>
            <View style={{ width: 56, alignItems: 'center' }}>
              <Text style={styles.colHeader}>GOAL</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.colHeader}>ACTUAL</Text>
            </View>
          </>
        )}
      </View>

      {/* ───── Set Rows ───── */}
      {exercise.sets.map((set: any, idx: number) => {
        const entry = entries?.[idx] || ({} as any);
        const setKey = `${exercise.name}-${idx}`;
        const isCompleted = !isTemplate && completedSets?.has(setKey);
        const isAutoFill = !isTemplate && autoFilled?.has(setKey) && !isCompleted;

        return (
          <Pressable
            key={idx}
            onLongPress={() => handleLongPressSet(idx)}
            delayLongPress={500}
            style={[styles.setRow, isCompleted && styles.setRowCompleted]}
          >
            {/* Checkmark */}
            {showCheckCol && (
              <Pressable
                onPress={() => onToggleComplete?.(exercise.name, idx)}
                style={[styles.checkCircle, isCompleted && styles.checkCircleCompleted]}
              >
                {isCompleted && <Text style={styles.checkMark}>{'\u2713'}</Text>}
              </Pressable>
            )}

            {/* Set number */}
            <View style={{ width: 32, alignItems: 'center' }}>
              <Text style={styles.setNumber}>
                {isTemplate ? idx + 1 : set.setNumber ?? idx + 1}
              </Text>
            </View>

            {/* Set type */}
            <View style={{ width: 56, alignItems: 'center' }}>
              {readOnly ? (
                <Text style={styles.setTypeText}>
                  {getSetTypeShort(entry.setType || exercise.setType || 'straight')}
                </Text>
              ) : (
                <Pressable
                  onPress={() => setTypePickerIdx(idx)}
                  style={styles.setTypePressable}
                >
                  <Text style={styles.setTypeText}>
                    {getSetTypeShort(entry.setType || exercise.setType || 'straight')}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Weight */}
            <View style={{ flex: 1, paddingHorizontal: 2 }}>
              <TextInput
                style={[
                  styles.input,
                  isCompleted && styles.inputCompleted,
                  isAutoFill && styles.inputAutoFill,
                ]}
                keyboardType="decimal-pad"
                value={String(entry.weight ?? (isTemplate ? '' : set.suggestedWeight ?? ''))}
                placeholder={readOnly ? '\u2014' : '0'}
                placeholderTextColor="#333"
                editable={!readOnly}
                selectTextOnFocus
                onChangeText={(v) => onChange?.(exercise.name, idx, 'weight', v)}
                onBlur={() => onBlur?.(exercise.name, idx, 'weight')}
              />
            </View>

            {isTemplate ? (
              /* Template: editable reps */
              <View style={{ flex: 1, paddingHorizontal: 2 }}>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={String(entry.reps ?? '')}
                  placeholder="0"
                  placeholderTextColor="#333"
                  selectTextOnFocus
                  onChangeText={(v) => onChange?.(exercise.name, idx, 'reps', v)}
                />
              </View>
            ) : (
              <>
                {/* Goal (read-only) */}
                <View style={{ width: 56, paddingHorizontal: 2 }}>
                  <View style={styles.goalBox}>
                    <Text style={styles.goalText}>
                      {set.plannedReps ?? '\u2014'}
                    </Text>
                  </View>
                </View>

                {/* Actual reps */}
                <View style={{ flex: 1, paddingHorizontal: 2 }}>
                  <TextInput
                    style={[
                      styles.input,
                      isCompleted && styles.inputCompleted,
                      isAutoFill && styles.inputAutoFill,
                    ]}
                    keyboardType="number-pad"
                    value={String(entry.reps ?? '')}
                    placeholder={readOnly ? '\u2014' : '0'}
                    placeholderTextColor="#333"
                    editable={!readOnly}
                    selectTextOnFocus
                    onChangeText={(v) => onChange?.(exercise.name, idx, 'reps', v)}
                    onBlur={() => onBlur?.(exercise.name, idx, 'reps')}
                  />
                </View>
              </>
            )}
          </Pressable>
        );
      })}

      {/* ───── Notes Section ───── */}
      {!readOnly && onNoteChange && (
        <View style={styles.notesSection}>
          {showNoteInput || note ? (
            <TextInput
              style={styles.noteInput}
              value={note || ''}
              placeholder="Add a note..."
              placeholderTextColor="#555"
              multiline
              onChangeText={(v) => onNoteChange(exercise.name, v)}
            />
          ) : (
            <Pressable onPress={() => setShowNoteInput(true)}>
              <Text style={styles.addNoteText}>+ Add Notes</Text>
            </Pressable>
          )}
        </View>
      )}
      {readOnly && note ? (
        <View style={styles.notesSection}>
          <Text style={styles.readOnlyNote}>{note}</Text>
        </View>
      ) : null}

      {/* ───── Set Type Picker Modal ───── */}
      <Modal
        visible={typePickerIdx !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTypePickerIdx(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setTypePickerIdx(null)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Type</Text>
            <FlatList
              data={SET_TYPES}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const currentType =
                  typePickerIdx !== null
                    ? entries?.[typePickerIdx]?.setType || exercise.setType || 'straight'
                    : '';
                const isSelected = item.value === currentType;
                return (
                  <Pressable
                    onPress={() => handleSetTypeSelect(item.value)}
                    style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                  >
                    <Text style={styles.modalOptionShort}>{item.short}</Text>
                    <Text style={styles.modalOptionLabel}>{item.label}</Text>
                    {isSelected && <Text style={styles.modalCheck}>{'\u2713'}</Text>}
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  exerciseName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  // Subheader
  subheader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  setCount: {
    fontSize: 10,
    color: '#6B7280',
    letterSpacing: 2,
    fontWeight: '500',
  },
  subheaderBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subheaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    gap: 4,
  },
  subheaderBtnPlus: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  subheaderBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 1,
  },
  subheaderBtnRemove: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    gap: 4,
  },
  subheaderBtnMinus: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  subheaderBtnTextRemove: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 1,
  },

  // Column headers
  colHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 6,
  },
  colHeader: {
    fontSize: 9,
    color: '#555555',
    letterSpacing: 1,
    fontWeight: '500',
  },

  // Set rows
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  setRowCompleted: {
    backgroundColor: 'rgba(34,197,94,0.1)',
  },

  // Checkmark
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleCompleted: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  checkMark: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Set number
  setNumber: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
  },

  // Set type
  setTypePressable: {
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  setTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
  },

  // Inputs
  input: {
    backgroundColor: '#111111',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 16,
  },
  inputCompleted: {
    color: '#FFFFFF',
  },
  inputAutoFill: {
    color: '#6B7280',
    fontStyle: 'italic',
  },

  // Goal box
  goalBox: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  goalText: {
    fontSize: 16,
    color: '#6B7280',
    fontVariant: ['tabular-nums'],
  },

  // Notes
  notesSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  noteInput: {
    backgroundColor: '#111111',
    borderRadius: 8,
    padding: 10,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 40,
  },
  addNoteText: {
    fontSize: 12,
    color: '#6B7280',
  },
  readOnlyNote: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    width: 280,
    maxHeight: 400,
    overflow: 'hidden',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  modalOptionSelected: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  modalOptionShort: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    width: 36,
  },
  modalOptionLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  modalCheck: {
    fontSize: 16,
    color: '#22C55E',
    fontWeight: '700',
  },
});

export default React.memo(ExerciseCard);
