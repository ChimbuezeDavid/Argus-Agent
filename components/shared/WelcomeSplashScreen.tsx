// Executive Welcome Splash Screen for Argus Agent
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useHCITheme } from '@/hooks/useHCITheme';

interface WelcomeSplashScreenProps {
  onFinish: () => void;
}

export function WelcomeSplashScreen({ onFinish }: WelcomeSplashScreenProps) {
  const { colors, isDark, scaleFont } = useHCITheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Entrance animation (fade & scale in)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Pulse orb
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 3. Complete and exit after 2.2 seconds
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 2200);

    return () => clearTimeout(timer);
  }, [fadeAnim, scaleAnim, pulseAnim, onFinish]);

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.background, opacity: fadeAnim }]}>
      {/* Center Branding Content */}
      <Animated.View style={[styles.centerContent, { transform: [{ scale: scaleAnim }] }]}>
        <Animated.View
          style={[
            styles.logoOrb,
            {
              backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(37, 99, 235, 0.1)',
              borderColor: colors.primary,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Ionicons name="sparkles" size={54} color={colors.primary} />
        </Animated.View>

        <Text style={[styles.brandTitle, { color: colors.text, fontSize: scaleFont(26) }]}>
          ARGUS AGENT
        </Text>
        <Text style={[styles.brandTagline, { color: colors.textSecondary, fontSize: scaleFont(12) }]}>
          Autonomous Mobile MCP • On-Device Intelligence
        </Text>
      </Animated.View>

      {/* Footer Powered By */}
      <View style={styles.footer}>
        <Text style={[styles.footerSub, { color: colors.textMuted, fontSize: scaleFont(10) }]}>POWERED BY</Text>
        <View style={styles.footerBrandRow}>
          <MaterialCommunityIcons name="google" size={14} color={colors.primary} style={{ marginRight: 4 }} />
          <Text style={[styles.footerBrand, { color: colors.text, fontSize: scaleFont(12) }]}>
            Gemini 3.5 & 3.7
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoOrb: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 20,
  },
  brandTitle: {
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 6,
  },
  brandTagline: {
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
  },
  footerSub: {
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerBrand: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
