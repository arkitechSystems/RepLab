import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, parseISO } from 'date-fns';
import { api } from '../api';
import { colors } from '../theme';

interface Entry {
  exerciseName: string;
  weight: number;
  reps: number;
  actualReps: number;
}

interface Session {
  id: number;
  templateName: string;
  date: string;
  entries: Entry[];
}

interface GroupedExercise {
  name: string;
  sets: Entry[];
}

export default function SessionDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api(`/sessions/${id}`);
        setSession(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load session');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const grouped: GroupedExercise[] = [];
  if (session?.entries) {
    const seen = new Map<string, number>();
    for (const entry of session.entries) {
      if (!seen.has(entry.exerciseName)) {
        seen.set(entry.exerciseName, grouped.length);
        grouped.push({ name: entry.exerciseName, sets: [] });
      }
      grouped[seen.get(entry.exerciseName)!].sets.push(entry);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.wfRed} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.center}>
          <Text style={styles.notFoundText}>Session not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>‹ Back</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{session.templateName}</Text>
        <Text style={styles.date}>{format(parseISO(session.date), 'EEEE, MMM d, yyyy')}</Text>

        {grouped.map((exercise, idx) => (
          <View key={idx} style={styles.exerciseCard}>
            <Text style={styles.exerciseName}>{exercise.name}</Text>
            <View style={styles.labelsRow}>
              <Text style={styles.labelText}>Set</Text>
              <Text style={styles.labelText}>Weight</Text>
              <Text style={styles.labelText}>Actual</Text>
            </View>
            {exercise.sets.map((set, setIdx) => (
              <View
                key={setIdx}
                style={[
                  styles.setRow,
                  setIdx < exercise.sets.length - 1 && styles.setRowBorder,
                ]}
              >
                <Text style={styles.setText}>{setIdx + 1}</Text>
                <Text style={styles.setValue}>{set.weight}</Text>
                <Text style={styles.setValue}>{set.actualReps}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  backText: {
    color: colors.wfRed,
    fontSize: 17,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: colors.gray[400],
    marginBottom: 24,
  },
  exerciseCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 14,
    padding: 16,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
    paddingBottom: 10,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  labelsRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  labelText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
    color: colors.gray[400],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  setRow: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  setRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  setText: {
    flex: 1,
    fontSize: 15,
    color: colors.gray[400],
    fontWeight: '500',
  },
  setValue: {
    flex: 1,
    fontSize: 15,
    color: colors.white,
    fontWeight: '500',
  },
  errorText: {
    color: colors.wfRed,
    fontSize: 15,
  },
  notFoundText: {
    color: colors.gray[400],
    fontSize: 16,
  },
});
