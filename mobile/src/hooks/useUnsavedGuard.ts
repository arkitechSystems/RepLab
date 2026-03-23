import { useState, useCallback, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';

interface Options {
  isDirty: boolean;
  onSave?: () => Promise<void>;
  saveLabel?: string;
}

/**
 * useUnsavedGuard — intercepts back navigation when there are unsaved changes.
 * Uses React Navigation's beforeRemove event.
 *
 * Returns:
 * - guardedNavigate: wrap navigation calls to check dirty state
 * - showModal / modalProps: for rendering a custom modal (optional, Alert is default)
 */
export function useUnsavedGuard({ isDirty, onSave, saveLabel = 'Save' }: Options) {
  const navigation = useNavigation();
  const isDirtyRef = useRef(isDirty);
  const [showModal, setShowModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // Intercept hardware/gesture back via React Navigation
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!isDirtyRef.current) return;

      // Prevent default back action
      e.preventDefault();

      // Show native alert
      Alert.alert(
        'Unsaved Changes',
        'Would you like to save your data before leaving?',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: () => {
              isDirtyRef.current = false;
              navigation.dispatch(e.data.action);
            },
          },
          ...(onSave
            ? [{
                text: saveLabel,
                onPress: async () => {
                  try {
                    await onSave();
                    isDirtyRef.current = false;
                    navigation.dispatch(e.data.action);
                  } catch {
                    // Save failed — stay on page
                  }
                },
              }]
            : []),
        ]
      );
    });

    return unsubscribe;
  }, [navigation, onSave, saveLabel]);

  // guardedNavigate for programmatic navigation (e.g. tapping a different workout)
  const guardedNavigate = useCallback((action: () => void) => {
    if (isDirtyRef.current) {
      Alert.alert(
        'Unsaved Changes',
        'Would you like to save your data before leaving?',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: () => {
              isDirtyRef.current = false;
              action();
            },
          },
          ...(onSave
            ? [{
                text: saveLabel,
                onPress: async () => {
                  try {
                    await onSave();
                    isDirtyRef.current = false;
                    action();
                  } catch {
                    // Save failed
                  }
                },
              }]
            : []),
        ]
      );
    } else {
      action();
    }
  }, [onSave, saveLabel]);

  return { guardedNavigate };
}
