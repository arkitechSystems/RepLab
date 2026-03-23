import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import * as Haptics from 'expo-haptics';

interface PBCelebrationProps {
  prs: { name: string; weight: number; reps: number }[];
  onDismiss: () => void;
}

export default function PBCelebration({ prs, onDismiss }: PBCelebrationProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    timerRef.current = setTimeout(onDismiss, 4500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onDismiss]);

  return (
    <Modal transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
            <Text style={styles.dismissText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.trophyCircle}>
            <Text style={styles.trophyEmoji}>🏆</Text>
          </View>

          <Text style={styles.header}>
            {prs.length === 1 ? 'New PR!' : 'New PRs!'}
          </Text>

          <FlatList
            data={prs}
            keyExtractor={(_, index) => String(index)}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.prRow}>
                <Text style={styles.prName}>{item.name}</Text>
                <Text style={styles.prValue}>
                  {item.weight} lbs × {item.reps}
                </Text>
              </View>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderColor: 'rgba(245,158,11,0.4)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    width: '85%',
    alignItems: 'center',
  },
  dismissButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  trophyCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(245,158,11,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  trophyEmoji: {
    fontSize: 36,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F59E0B',
    marginBottom: 16,
  },
  prRow: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    width: '100%',
    alignItems: 'center',
  },
  prName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  prValue: {
    color: '#F59E0B',
    fontSize: 15,
    fontWeight: '500',
  },
});
