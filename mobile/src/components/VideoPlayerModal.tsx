import React from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal, Linking,
} from 'react-native';

interface Props {
  videoId: string;
  exerciseName: string;
  onClose: () => void;
}

/**
 * VideoPlayerModal — opens YouTube video.
 * React Native doesn't support iframes, so we open in the browser/YouTube app.
 * If you want inline playback, install react-native-youtube-iframe later.
 */
export default function VideoPlayerModal({ videoId, exerciseName, onClose }: Props) {
  function handleWatch() {
    Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`);
    onClose();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={2}>{exerciseName}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {/* Thumbnail placeholder */}
          <View style={styles.thumbnail}>
            <Text style={styles.playIcon}>▶</Text>
          </View>

          {/* Open in YouTube */}
          <Pressable onPress={handleWatch} style={styles.watchButton}>
            <Text style={styles.watchText}>Watch on YouTube</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#FFFFFF', fontSize: 16 },
  thumbnail: {
    aspectRatio: 16 / 9,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { fontSize: 48, color: 'rgba(255,255,255,0.3)' },
  watchButton: {
    margin: 16,
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  watchText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
