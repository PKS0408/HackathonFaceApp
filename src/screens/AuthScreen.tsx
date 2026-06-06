import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';

interface AuthScreenProps {
  onBack: () => void;
  authResult: null | {
    approved: boolean;
    name?: string;
    time?: string;
    score?: number;
  };
  isProcessing: boolean;
  livenessWarning: boolean;
  challengeType: 'blink' | 'smile' | 'turn_left' | 'turn_right';
  lowLightFlash: boolean;
}

export default function AuthScreen({ 
  onBack, 
  authResult, 
  isProcessing,
  livenessWarning,
  challengeType,
  lowLightFlash 
}: AuthScreenProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const resultFade = useRef(new Animated.Value(0)).current;
  const resultScale = useRef(new Animated.Value(0.8)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse scope
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    // Scan line animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (authResult) {
      resultFade.setValue(0);
      resultScale.setValue(0.8);
      Animated.parallel([
        Animated.timing(resultFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(resultScale, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [authResult]);

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 120],
  });

  const challengeText = {
    'blink': '😉 Please BLINK to authenticate',
    'smile': '😊 Please SMILE to authenticate',
    'turn_left': '👈 Turn Head LEFT to authenticate',
    'turn_right': '👉 Turn Head RIGHT to authenticate'
  }[challengeType];

  return (
    <View style={styles.container}>
      {lowLightFlash && <View style={styles.flashOverlay} pointerEvents="none" />}
      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      {/* Mode indicator */}
      <View style={styles.modeIndicator}>
        <View style={styles.modeDot} />
        <Text style={styles.modeText}>AUTHENTICATION MODE</Text>
      </View>

      {/* Center scope */}
      <View style={styles.scopeContainer} pointerEvents="none">
        <Animated.View style={[styles.scope, { transform: [{ scale: pulseAnim }] }]}>
          <View style={[styles.scopeCorner, styles.topLeft]} />
          <View style={[styles.scopeCorner, styles.topRight]} />
          <View style={[styles.scopeCorner, styles.bottomLeft]} />
          <View style={[styles.scopeCorner, styles.bottomRight]} />

          {/* Scan line */}
          <Animated.View
            style={[
              styles.scanLine,
              { transform: [{ translateY: scanLineTranslate }] },
            ]}
          />
        </Animated.View>

        {!authResult && (
          <Text style={styles.scopeInstruction}>
            {isProcessing ? '⏳ Checking database...' : challengeText}
          </Text>
        )}
      </View>

      {/* Auth Result Overlay */}
      {authResult && (
        <Animated.View
          style={[
            styles.resultOverlay,
            {
              backgroundColor: authResult.approved
                ? 'rgba(0, 255, 135, 0.15)'
                : 'rgba(255, 59, 48, 0.15)',
              opacity: resultFade,
              transform: [{ scale: resultScale }],
            },
          ]}
        >
          <View style={[
            styles.resultCard,
            {
              borderColor: authResult.approved
                ? 'rgba(0, 255, 135, 0.3)'
                : 'rgba(255, 59, 48, 0.3)',
            },
          ]}>
            <Text style={styles.resultEmoji}>
              {authResult.approved ? '✅' : '❌'}
            </Text>
            <Text
              style={[
                styles.resultTitle,
                { color: authResult.approved ? '#00ff87' : '#ff3b30' },
              ]}
            >
              {authResult.approved ? 'APPROVED' : 'NOT APPROVED'}
            </Text>
            {authResult.approved && authResult.name ? (
              <>
                <View style={styles.resultInfoRow}>
                  <Text style={styles.resultLabel}>Identity</Text>
                  <Text style={styles.resultValue}>{authResult.name}</Text>
                </View>
                <View style={styles.resultInfoRow}>
                  <Text style={styles.resultLabel}>Time</Text>
                  <Text style={styles.resultValue}>{authResult.time}</Text>
                </View>
                {authResult.score && (
                  <View style={styles.resultInfoRow}>
                    <Text style={styles.resultLabel}>Confidence</Text>
                    <Text style={styles.resultValue}>{(authResult.score * 100).toFixed(1)}%</Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.resultSubtext}>
                User not found in database
              </Text>
            )}

            <TouchableOpacity
              style={[
                styles.tryAgainBtn,
                {
                  borderColor: authResult.approved
                    ? 'rgba(0, 255, 135, 0.3)'
                    : 'rgba(255, 59, 48, 0.3)',
                },
              ]}
              onPress={onBack}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tryAgainText,
                  { color: authResult.approved ? '#00ff87' : '#ff3b30' },
                ]}
              >
                Back to Home
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Bottom status */}
      <View style={styles.bottomBar}>
        <View style={styles.statusPill}>
          <View style={[styles.statusDotBottom, {
            backgroundColor: authResult
              ? (authResult.approved ? '#00ff87' : '#ff3b30')
              : (isProcessing ? '#ffa500' : '#00ff87'),
          }]} />
          <Text style={styles.statusText}>
            {authResult
              ? (authResult.approved ? 'Identity verified' : 'Identity rejected')
              : (isProcessing ? 'Processing face data...' : 'Liveness detection active')
            }
          </Text>
        </View>
      </View>
    </View>
  );
}

const CORNER = 35;
const SCOPE_SIZE = 300;
const BORDER_W = 4;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  backBtn: {
    position: 'absolute',
    top: 55,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backArrow: {
    color: '#00ff87',
    fontSize: 28,
    fontWeight: '300',
    marginRight: 4,
  },
  backText: {
    color: '#00ff87',
    fontSize: 16,
    fontWeight: '500',
  },
  modeIndicator: {
    position: 'absolute',
    top: 55,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  modeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00ff87',
  },
  modeText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  scopeContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  scope: {
    width: SCOPE_SIZE,
    height: SCOPE_SIZE,
    borderRadius: SCOPE_SIZE / 2,
    position: 'relative',
    overflow: 'hidden',
  },
  scopeCorner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
  },
  topLeft: {
    top: 0,
    left: 25,
    borderTopWidth: BORDER_W,
    borderLeftWidth: BORDER_W,
    borderColor: '#00ff87',
    borderTopLeftRadius: SCOPE_SIZE / 2,
  },
  topRight: {
    top: 0,
    right: 25,
    borderTopWidth: BORDER_W,
    borderRightWidth: BORDER_W,
    borderColor: '#00ff87',
    borderTopRightRadius: SCOPE_SIZE / 2,
  },
  bottomLeft: {
    bottom: 0,
    left: 25,
    borderBottomWidth: BORDER_W,
    borderLeftWidth: BORDER_W,
    borderColor: '#00ff87',
    borderBottomLeftRadius: SCOPE_SIZE / 2,
  },
  bottomRight: {
    bottom: 0,
    right: 25,
    borderBottomWidth: BORDER_W,
    borderRightWidth: BORDER_W,
    borderColor: '#00ff87',
    borderBottomRightRadius: SCOPE_SIZE / 2,
  },
  scanLine: {
    position: 'absolute',
    left: 30,
    right: 30,
    height: 2,
    top: '50%',
    backgroundColor: 'rgba(0, 255, 135, 0.5)',
    shadowColor: '#00ff87',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
  scopeInstruction: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  resultOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 90,
  },
  resultCard: {
    backgroundColor: 'rgba(10, 14, 39, 0.95)',
    borderRadius: 28,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1.5,
    marginHorizontal: 30,
    width: '85%',
  },
  resultEmoji: {
    fontSize: 72,
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 24,
    letterSpacing: 2,
  },
  resultInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  resultLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontWeight: '500',
  },
  resultValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  resultSubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    marginBottom: 10,
    textAlign: 'center',
  },
  tryAgainBtn: {
    marginTop: 28,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 36,
  },
  tryAgainText: {
    fontSize: 16,
    fontWeight: '700',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 100,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statusDotBottom: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  flashOverlay: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    zIndex: -1,
  },
});
