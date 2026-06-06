import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

interface RegisterScreenProps {
  onBack: () => void;
  onStartCapture: (name: string) => void;
  isCapturing: boolean;
  captureSuccess: boolean;
  duplicateUser: string | null;
  livenessWarning: boolean;
  challengeType: 'blink' | 'smile' | 'turn_left' | 'turn_right';
  lowLightFlash: boolean;
}

export default function RegisterScreen({
  onBack,
  onStartCapture,
  isCapturing,
  captureSuccess,
  duplicateUser,
  livenessWarning,
  challengeType,
  lowLightFlash,
}: RegisterScreenProps) {
  const [name, setName] = useState('');
  const [step, setStep] = useState<'name' | 'camera'>('name');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (step === 'camera') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [step]);

  const handleContinue = () => {
    if (name.trim().length === 0) return;
    setStep('camera');
    onStartCapture(name.trim());
  };

  if (duplicateUser) {
    return (
      <View style={styles.successContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0e27" />
        <View style={styles.successContent}>
          <Text style={styles.successEmoji}>⚠️</Text>
          <Text style={[styles.successTitle, { color: '#ffa500' }]}>Already Registered</Text>
          <Text style={styles.successName}>{duplicateUser}</Text>
          <Text style={styles.successDesc}>This face is already in the database</Text>
          <TouchableOpacity style={[styles.doneBtn, { borderColor: 'rgba(255, 165, 0, 0.3)', backgroundColor: 'rgba(255, 165, 0, 0.15)' }]} onPress={onBack} activeOpacity={0.8}>
            <Text style={[styles.doneBtnText, { color: '#ffa500' }]}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (captureSuccess) {
    return (
      <View style={styles.successContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0e27" />
        <View style={styles.successContent}>
          <Text style={styles.successEmoji}>✅</Text>
          <Text style={styles.successTitle}>Registered!</Text>
          <Text style={styles.successName}>{name}</Text>
          <Text style={styles.successDesc}>Face has been saved to the database</Text>
          <TouchableOpacity style={styles.doneBtn} onPress={onBack} activeOpacity={0.8}>
            <Text style={styles.doneBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === 'camera') {
    const challengeText = {
      'blink': '😉 Please BLINK to capture',
      'smile': '😊 Please SMILE to capture',
      'turn_left': '👈 Turn Head LEFT to capture',
      'turn_right': '👉 Turn Head RIGHT to capture'
    }[challengeType];

    return (
      <View style={styles.cameraOverlay}>
        {lowLightFlash && <View style={styles.flashOverlay} pointerEvents="none" />}
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        {/* Back button */}
        <TouchableOpacity style={styles.backBtnCamera} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>

        {/* Top info bar */}
        <View style={styles.topInfoBar}>
          <Text style={styles.registeringForText}>Registering</Text>
          <Text style={styles.registeringName}>{name}</Text>
        </View>

        {/* Center scope */}
        <View style={styles.scopeContainer} pointerEvents="none">
          <Animated.View style={[styles.scope, { transform: [{ scale: pulseAnim }] }]}>
            <View style={[styles.scopeCorner, styles.topLeft]} />
            <View style={[styles.scopeCorner, styles.topRight]} />
            <View style={[styles.scopeCorner, styles.bottomLeft]} />
            <View style={[styles.scopeCorner, styles.bottomRight]} />
          </Animated.View>
          <Text style={styles.scopeInstruction}>
            {isCapturing ? '📸 Processing... Hold still!' : challengeText}
          </Text>
        </View>

        {/* Bottom status */}
        <View style={styles.bottomBar}>
          {livenessWarning && (
            <View style={[styles.statusPill, { borderColor: 'rgba(255, 165, 0, 0.3)', marginBottom: 10 }]}>
              <Text style={styles.statusText}>⚠️ Failed challenge — please {challengeText.split('Please ')[1] || 'try again'}</Text>
            </View>
          )}
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: isCapturing ? '#ffa500' : (livenessWarning ? '#ffa500' : '#00ff87') }]} />
            <Text style={styles.statusText}>
              {isCapturing ? 'Capturing face data...' : 'Waiting for liveness signal'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0a0e27" />

      {/* Background orbs */}
      <View style={styles.bgOrb1} />

      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Text style={styles.backArrow}>‹</Text>
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, styles.stepActive]} />
          <View style={styles.stepLine} />
          <View style={styles.stepDot} />
        </View>

        <Text style={styles.heading}>New Registration</Text>
        <Text style={styles.description}>Enter the person's name, then we'll capture their face</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter name..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="next"
            onSubmitEditing={handleContinue}
          />
        </View>

        <TouchableOpacity
          style={[styles.continueBtn, name.trim().length === 0 && styles.continueBtnDisabled]}
          onPress={handleContinue}
          activeOpacity={0.8}
          disabled={name.trim().length === 0}
        >
          <Text style={styles.continueBtnText}>Continue to Camera</Text>
          <Text style={styles.continueBtnArrow}>→</Text>
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const CORNER = 30;
const SCOPE_SIZE = 280;
const BORDER_W = 4;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  bgOrb1: {
    position: 'absolute',
    top: 60,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0, 212, 255, 0.07)',
  },
  backBtn: {
    position: 'absolute',
    top: 55,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  backBtnCamera: {
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
    color: '#00d4ff',
    fontSize: 28,
    fontWeight: '300',
    marginRight: 4,
  },
  backText: {
    color: '#00d4ff',
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    alignItems: 'stretch',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    alignSelf: 'center',
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  stepActive: {
    backgroundColor: '#00d4ff',
    borderColor: '#00d4ff',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 8,
  },
  heading: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 40,
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 30,
  },
  inputLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 212, 255, 0.25)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '500',
  },
  continueBtn: {
    backgroundColor: '#00d4ff',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  continueBtnDisabled: {
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
  },
  continueBtnText: {
    color: '#0a0e27',
    fontSize: 17,
    fontWeight: '700',
  },
  continueBtnArrow: {
    color: '#0a0e27',
    fontSize: 20,
    fontWeight: '700',
  },

  // Camera overlay styles
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  topInfoBar: {
    position: 'absolute',
    top: 55,
    right: 20,
    alignItems: 'flex-end',
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  registeringForText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  registeringName: {
    color: '#00d4ff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
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
  },
  scopeCorner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
  },
  topLeft: {
    top: 0,
    left: 20,
    borderTopWidth: BORDER_W,
    borderLeftWidth: BORDER_W,
    borderColor: '#00d4ff',
    borderTopLeftRadius: SCOPE_SIZE / 2,
  },
  topRight: {
    top: 0,
    right: 20,
    borderTopWidth: BORDER_W,
    borderRightWidth: BORDER_W,
    borderColor: '#00d4ff',
    borderTopRightRadius: SCOPE_SIZE / 2,
  },
  bottomLeft: {
    bottom: 0,
    left: 20,
    borderBottomWidth: BORDER_W,
    borderLeftWidth: BORDER_W,
    borderColor: '#00d4ff',
    borderBottomLeftRadius: SCOPE_SIZE / 2,
  },
  bottomRight: {
    bottom: 0,
    right: 20,
    borderBottomWidth: BORDER_W,
    borderRightWidth: BORDER_W,
    borderColor: '#00d4ff',
    borderBottomRightRadius: SCOPE_SIZE / 2,
  },
  scopeInstruction: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 60,
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
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
  },

  // Success screen
  successContainer: {
    flex: 1,
    backgroundColor: '#0a0e27',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successContent: {
    alignItems: 'center',
  },
  successEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#00ff87',
    marginBottom: 8,
  },
  successName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  successDesc: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 40,
  },
  doneBtn: {
    backgroundColor: 'rgba(0, 255, 135, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 135, 0.3)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 40,
  },
  doneBtnText: {
    color: '#00ff87',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  flashOverlay: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    zIndex: -1,
  },
});
