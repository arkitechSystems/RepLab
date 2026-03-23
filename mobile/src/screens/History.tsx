import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, parseISO } from 'date-fns';
import { api } from '../api';
import { getWorkoutColor } from '../utils/workoutColors';
import useCountUp from '../hooks/useCountUp';
import { colors } from '../theme';

interface Session {
  id: number;
  templateName: string;
  date: string;
}

export default function HistoryScreen({ navigation }: any) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uniqueWorkouts = new Set(sessions.map((s) => s.templateName)).size;
  const sessionCount = useCountUp(sessions.length);
  const workoutCount = useCountUp(uniqueWorkouts);

  const fetchSessions = useCallback(async () => {
    try {
      setError(null);
      const data = await api('/sessions');
      setSessions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSessions();
  }, [fetchSessions]);

  const renderSession = ({ item }: { item: Session }) => {
    const color = getWorkoutColor(item.templateName);
    return (
      <TouchableOpacity
        style={[styles.card, { borderLeftColor: color.hex, borderLeftWidth: 3 }]}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('SessionDetail', { id: item.id })}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardLeft}>
            <View style={[styles.dot, { backgroundColor: color.hex }]} />
            <View>
              <Text style={styles.templateName}>{item.templateName}</Text>
              <Text style={styles.dateText}>
                {format(parseISO(item.date), 'EEEE, MMM d, yyyy')}
              </Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.header}>History</Text>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.wfRed} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.header}>History</Text>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchSessions}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>History</Text>

      {/* Stats bar */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{sessionCount}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{workoutCount}</Text>
          <Text style={styles.statLabel}>Workouts</Text>
        </View>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🕐</Text>
          <Text style={styles.emptyText}>No workouts logged yet</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderSession}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.white} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.white,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.white,
  },
  statLabel: {
    fontSize: 12,
    color: colors.gray[400],
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  dateText: {
    fontSize: 13,
    color: colors.gray[400],
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: colors.gray[400],
    marginLeft: 8,
  },
  errorText: {
    color: colors.wfRed,
    fontSize: 15,
    marginBottom: 12,
  },
  retryBtn: {
    backgroundColor: colors.wfRed,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 15,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: colors.gray[400],
    fontSize: 16,
  },
});
