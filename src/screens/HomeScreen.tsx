import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

interface HomeScreenProps {
  onNavigate: (screen: 'register' | 'auth') => void;
  isOnline: boolean;
  pendingLogsCount: number;
}

export default function HomeScreen({ onNavigate, isOnline, pendingLogsCount }: HomeScreenProps) {
  const [userCount, setUserCount] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUp1 = useRef(new Animated.Value(60)).current;
  const slideUp2 = useRef(new Animated.Value(60)).current;
  const scaleTitle = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadUserCount();

    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(scaleTitle, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
      ]),
      Animated.stagger(150, [
        Animated.parallel([
          Animated.timing(slideUp1, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(slideUp2, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
      ]),
    ]).start();

    // Pulse animation for the orb
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const loadUserCount = async () => {
    try {
      const data = await AsyncStorage.getItem('@face_dataset');
      if (data) {
        setUserCount(JSON.parse(data).length);
      }
    } catch (e) {
      console.log('Error loading dataset:', e);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e27" />

      {/* Background orb decorations */}
      <Animated.View style={[styles.bgOrb1, { transform: [{ scale: pulseAnim }] }]} />
      <Animated.View style={[styles.bgOrb2, { transform: [{ scale: pulseAnim }] }]} />

      {/* Network Sync Badge */}
      <View style={[styles.syncBadge, { borderColor: isOnline ? 'rgba(0, 255, 135, 0.3)' : 'rgba(255, 165, 0, 0.3)' }]}>
        <View style={[styles.syncDot, { backgroundColor: isOnline ? '#00ff87' : '#ffa500' }]} />
        <Text style={[styles.syncText, { color: isOnline ? '#00ff87' : '#ffa500' }]}>
          {isOnline 
            ? (pendingLogsCount > 0 ? `Syncing ${pendingLogsCount} logs to AWS...` : 'Online - Datalake Synced') 
            : `Offline Mode - ${pendingLogsCount} pending logs`}
        </Text>
      </View>

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ scale: scaleTitle }] }]}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>🔐</Text>
          </View>
        </View>
        <Text style={styles.title}>FaceAuth</Text>
        <Text style={styles.subtitle}>AI-Powered Face Recognition</Text>
        <View style={styles.divider} />
        <Text style={styles.statsText}>
          {userCount > 0 ? `${userCount} user${userCount > 1 ? 's' : ''} registered` : 'No users registered yet'}
        </Text>
      </Animated.View>

      {/* Cards */}
      <View style={styles.cardsContainer}>
        <Animated.View style={{ transform: [{ translateY: slideUp1 }], opacity: Animated.subtract(1, Animated.divide(slideUp1, 60)) }}>
          <TouchableOpacity
            style={[styles.card, styles.registerCard]}
            onPress={() => onNavigate('register')}
            activeOpacity={0.85}
          >
            <View style={styles.cardIconContainer}>
              <View style={[styles.cardIconBg, { backgroundColor: 'rgba(0, 212, 255, 0.15)' }]}>
                <Text style={styles.cardIcon}>👤</Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Register</Text>
              <Text style={styles.cardDesc}>Add a new face to the database</Text>
            </View>
            <Text style={styles.cardArrow}>›</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={{ transform: [{ translateY: slideUp2 }], opacity: Animated.subtract(1, Animated.divide(slideUp2, 60)) }}>
          <TouchableOpacity
            style={[styles.card, styles.authCard]}
            onPress={() => onNavigate('auth')}
            activeOpacity={0.85}
          >
            <View style={styles.cardIconContainer}>
              <View style={[styles.cardIconBg, { backgroundColor: 'rgba(0, 255, 135, 0.15)' }]}>
                <Text style={styles.cardIcon}>🔍</Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Authenticate</Text>
              <Text style={styles.cardDesc}>Verify identity with liveness check</Text>
            </View>
            <Text style={styles.cardArrow}>›</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Footer */}
      <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
        <Text style={styles.footerText}>Secured by on-device AI</Text>
        <View style={styles.footerDots}>
          <View style={[styles.dot, { backgroundColor: '#00d4ff' }]} />
          <View style={[styles.dot, { backgroundColor: '#00ff87' }]} />
          <View style={[styles.dot, { backgroundColor: '#a855f7' }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  bgOrb1: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(0, 212, 255, 0.08)',
  },
  bgOrb2: {
    position: 'absolute',
    bottom: -100,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(0, 255, 135, 0.06)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(0, 212, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: {
    fontSize: 40,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 6,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  divider: {
    width: 40,
    height: 3,
    backgroundColor: '#00d4ff',
    marginTop: 20,
    borderRadius: 2,
  },
  statsText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 13,
    marginTop: 14,
    fontFamily: 'monospace',
  },
  cardsContainer: {
    gap: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
  },
  registerCard: {
    backgroundColor: 'rgba(0, 212, 255, 0.06)',
    borderColor: 'rgba(0, 212, 255, 0.2)',
  },
  authCard: {
    backgroundColor: 'rgba(0, 255, 135, 0.06)',
    borderColor: 'rgba(0, 255, 135, 0.2)',
  },
  cardIconContainer: {
    marginRight: 16,
  },
  cardIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIcon: {
    fontSize: 28,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  cardDesc: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 13,
    marginTop: 4,
  },
  cardArrow: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 32,
    fontWeight: '300',
  },
  footer: {
    alignItems: 'center',
    marginTop: 60,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.25)',
    fontSize: 12,
    letterSpacing: 1,
  },
  footerDots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  syncBadge: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    zIndex: 100,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  syncText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
});
