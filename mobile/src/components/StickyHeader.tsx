import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, ViewStyle, NativeScrollEvent, NativeSyntheticEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';

interface Props {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  bottomContent?: React.ReactNode | ((collapsed: boolean) => React.ReactNode);
}

/**
 * StickyHeader for React Native.
 *
 * Usage: Wrap your screen content in a ScrollView and pass the onScroll handler.
 *
 * ```tsx
 * const { headerComponent, onScroll, collapsed } = useStickyHeader({ title, subtitle });
 * return (
 *   <>
 *     {headerComponent}
 *     <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16}>
 *       {content}
 *     </Animated.ScrollView>
 *   </>
 * );
 * ```
 */
export function useStickyHeader({ title, subtitle, children, bottomContent }: Props) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const [collapsed, setCollapsed] = useState(false);

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = event.nativeEvent.contentOffset.y;
        setCollapsed(y > 20);
      },
    }
  );

  const titleSize = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [30, 20],
    extrapolate: 'clamp',
  });

  const headerPadding = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [24, 12],
    extrapolate: 'clamp',
  });

  const subtitleOpacity = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const headerComponent = (
    <View style={styles.headerOuter}>
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.headerInner, { paddingVertical: headerPadding }]}>
        <View style={styles.headerRow}>
          {title ? (
            <View style={styles.titleContainer}>
              <Animated.Text style={[styles.title, { fontSize: titleSize }]}>
                {title}
              </Animated.Text>
              {subtitle ? (
                <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>
                  {subtitle}
                </Animated.Text>
              ) : null}
            </View>
          ) : null}
          {children}
        </View>
        {typeof bottomContent === 'function'
          ? bottomContent(collapsed)
          : bottomContent}
      </Animated.View>
    </View>
  );

  return { headerComponent, onScroll, scrollY, collapsed };
}

/**
 * Standalone StickyHeader component for simpler use cases.
 * Does not animate — just renders a static header.
 */
export default function StickyHeader({ title, subtitle, children, bottomContent }: Props) {
  return (
    <View style={styles.headerOuter}>
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[styles.headerInner, { paddingVertical: 24 }]}>
        <View style={styles.headerRow}>
          {title ? (
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { fontSize: 30 }]}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          ) : null}
          {children}
        </View>
        {typeof bottomContent === 'function'
          ? bottomContent(false)
          : bottomContent}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerOuter: {
    overflow: 'hidden',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerInner: {
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleContainer: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#888888',
    fontSize: 13,
    marginTop: 2,
  },
});
