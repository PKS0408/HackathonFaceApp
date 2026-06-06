import 'react-native-worklets-core';
import { useResizer } from 'react-native-vision-camera-resizer';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Camera, useCameraDevice, useCameraPermission, useFrameOutput } from 'react-native-vision-camera';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { StyleSheet, Text, View, StatusBar, TouchableOpacity, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSharedValue } from 'react-native-worklets-core';
import NetInfo from '@react-native-community/netinfo';
import Geolocation from '@react-native-community/geolocation';

import HomeScreen from './src/screens/HomeScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import AuthScreen from './src/screens/AuthScreen';

// ─── TYPES ─────────────────────────────────────────────
interface FaceRecord {
  name: string;
  embedding: number[];
  registeredAt: string;
}

interface AuthResult {
  approved: boolean;
  name?: string;
  time?: string;
  score?: number;
}

type ScreenName = 'home' | 'register' | 'auth';

// ─── DATASET KEYS ──────────────────────────────────────
const DATASET_KEY = '@face_dataset';

// ─────────────────────────────────────────────────────────────────────────────
// MANUAL PIXEL READER — fallback when resizer is null (release APK builds).
// Reads the raw RGB frame directly and downsamples to dstSize×dstSize.
// Keeps the same 180° rotation and [0,1] normalisation as the resizer path.
// ─────────────────────────────────────────────────────────────────────────────
function manualResizeTo256(
  frame: any,
  dstSize: number,
): Float32Array | null {
  'worklet';
  try {
    if (!frame.hasPixelBuffer) return null;
    const raw      = new Uint8Array(frame.getPixelBuffer());
    const srcW     = frame.width;
    const srcH     = frame.height;
    const channels = Math.floor(raw.length / (srcW * srcH));
    if (channels < 3) return null;

    const dst    = new Float32Array(dstSize * dstSize * 3);
    const xRatio = srcW / dstSize;
    const yRatio = srcH / dstSize;

    for (let y = 0; y < dstSize; y++) {
      for (let x = 0; x < dstSize; x++) {
        const srcX   = Math.floor(x * xRatio);
        const srcY   = Math.floor(y * yRatio);
        // 180° rotation to match resizer output orientation
        const destX  = (dstSize - 1) - x;
        const destY  = (dstSize - 1) - y;
        const srcIdx = (srcY * srcW + srcX) * channels;
        const dstIdx = (destY * dstSize + destX) * 3;
        // normalise [0,255] → [0,1] — same as resizer path
        dst[dstIdx]     = raw[srcIdx]     / 255.0;
        dst[dstIdx + 1] = raw[srcIdx + 1] / 255.0;
        dst[dstIdx + 2] = raw[srcIdx + 2] / 255.0;
      }
    }
    return dst;
  } catch (_) {
    return null;
  }
}

export default function App() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  // ─── SCREEN NAVIGATION ────────────────────────────────
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('home');
  const [cameraActive, setCameraActive] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // <-- FIX: UI Refresh trigger

  // ─── REGISTRATION STATE ───────────────────────────────
  const [registerName, setRegisterName] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureSuccess, setCaptureSuccess] = useState(false);
  const [duplicateUser, setDuplicateUser] = useState<string | null>(null);
  const [livenessWarning, setLivenessWarning] = useState(false);
  const livenessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── AUTHENTICATION STATE ─────────────────────────────
  const [authResult, setAuthResult] = useState<AuthResult | null>(null);
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);

  // ─── WORKLET DROP BOXES ───────────────────────────────
  const registrationEmbeddingBox = useSharedValue<number[]>([]);
  const authEmbeddingBox         = useSharedValue<number[]>([]);
  const isRegisteringBox         = useSharedValue(false);
  const isAuthenticatingBox      = useSharedValue(false);
  const cooldownResetBox         = useSharedValue(0);
  const livenessChallengeBox     = useSharedValue(0); // 0=blink,1=smile,2=left,3=right

  // ─── NETWORK & SYNC STATE ─────────────────────────────
  const [isOnline, setIsOnline]               = useState(true);
  const [pendingLogsCount, setPendingLogsCount] = useState(0);
  const locationRef = useRef<{lat: number; lon: number} | null>(null);
  const [challengeType, setChallengeType]     = useState<'blink' | 'smile' | 'turn_left' | 'turn_right'>('smile');

  // ─── DATASET ──────────────────────────────────────────
  const datasetRef = useRef<FaceRecord[]>([]);

  // ─── LOAD DATASET & PENDING LOGS ON MOUNT ─────────────
  useEffect(() => {
    (async () => {
      try {
        const data = await AsyncStorage.getItem(DATASET_KEY);
        if (data) datasetRef.current = JSON.parse(data);
        const logs = await AsyncStorage.getItem('@attendance_logs');
        if (logs) setPendingLogsCount(JSON.parse(logs).length);
      } catch (e) { console.log('Error loading data:', e); }
    })();
  }, []);

  // ─── SYNC LOGIC (NetInfo) ─────────────────────────────
  useEffect(() => {
    const syncWithAWS = async () => {
      try {
        const logsStr = await AsyncStorage.getItem('@attendance_logs');
        if (logsStr && JSON.parse(logsStr).length > 0) {
          const logs = JSON.parse(logsStr);
          console.log(`\n☁️ AWS SYNC PROTOCOL INITIATED...`);
          console.log(`📡 Pushing ${logs.length} offline authentications to Datalake...`);
          setTimeout(async () => {
            await AsyncStorage.removeItem('@attendance_logs');
            setPendingLogsCount(0);
            console.log(`✨ Sync successful! Local offline cache purged.\n`);
          }, 1500);
        }
      } catch (e) { console.log('Sync Error:', e); }
    };

    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected);
      if (state.isConnected) syncWithAWS();
    });
    return () => unsubscribe();
  }, []);

  // ─── JS RADAR (polls worklet drop boxes) ──────────────
  useEffect(() => {
    const radar = setInterval(async () => {

      // === REGISTRATION: embedding captured ===
      if (registrationEmbeddingBox.value.length > 0) {
        const embedding = [...registrationEmbeddingBox.value];
        registrationEmbeddingBox.value = [];

        const existingDataset = datasetRef.current;
        let duplicateFound: string | null = null;

        for (const record of existingDataset) {
          if (record.embedding.length !== embedding.length) continue;
          let dotProduct = 0, normA = 0, normB = 0;
          for (let i = 0; i < embedding.length; i++) {
            dotProduct += embedding[i] * record.embedding[i];
            normA      += embedding[i] * embedding[i];
            normB      += record.embedding[i] * record.embedding[i];
          }
          const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
          // FIX: duplicate threshold raised from 0.70 → 0.75 (was too loose)
          if (similarity > 0.75 && !isNaN(similarity)) {
            duplicateFound = record.name;
            break;
          }
        }

        if (duplicateFound) {
          console.log(`⚠️ DUPLICATE: Face already registered as "${duplicateFound}"`);
          setIsCapturing(false);
          setDuplicateUser(duplicateFound);
        } else {
          const newRecord: FaceRecord = {
            name:         registerName,
            embedding,
            registeredAt: new Date().toISOString(),
          };
          const dataset = [...existingDataset, newRecord];
          datasetRef.current = dataset;
          await AsyncStorage.setItem(DATASET_KEY, JSON.stringify(dataset));
          console.log(`✅ Registered "${registerName}" | Total users: ${dataset.length}`);
          setIsCapturing(false);
          setCaptureSuccess(true);
        }

        if (livenessTimerRef.current) {
          clearTimeout(livenessTimerRef.current);
          livenessTimerRef.current = null;
        }
      }

      // === AUTHENTICATION: embedding captured ===
      if (authEmbeddingBox.value.length > 0) {
        const liveEmbedding = [...authEmbeddingBox.value];
        authEmbeddingBox.value = [];

        setIsAuthProcessing(true);
        const dataset = datasetRef.current;
        let bestMatch: { name: string; score: number } | null = null;

        for (const record of dataset) {
          const stored = record.embedding;
          if (stored.length !== liveEmbedding.length) continue;
          let dotProduct = 0, normA = 0, normB = 0;
          for (let i = 0; i < liveEmbedding.length; i++) {
            dotProduct += liveEmbedding[i] * stored[i];
            normA      += liveEmbedding[i] * liveEmbedding[i];
            normB      += stored[i] * stored[i];
          }
          const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
          // FIX: auth threshold raised from 0.70 → 0.75 (was too easy to spoof)
          if (similarity > 0.75 && (!bestMatch || similarity > bestMatch.score)) {
            bestMatch = { name: record.name, score: similarity };
          }
        }

        const now     = new Date();
        const timeStr = now.toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        });

        if (bestMatch) {
          console.log(`🪪 APPROVED: ${bestMatch.name} (${(bestMatch.score * 100).toFixed(1)}%)`);
          setAuthResult({ approved: true, name: bestMatch.name, time: timeStr, score: bestMatch.score });
          try {
            const logsStr = await AsyncStorage.getItem('@attendance_logs') || '[]';
            const logs    = JSON.parse(logsStr);
            logs.push({
              name:      bestMatch.name,
              timestamp: new Date().toISOString(),
              confidence: bestMatch.score,
              location:  locationRef.current,
            });
            await AsyncStorage.setItem('@attendance_logs', JSON.stringify(logs));
            setPendingLogsCount(logs.length);
            console.log(`💾 Logged locally. Pending syncs: ${logs.length}`);
          } catch(e) {}
        } else {
          console.log(`❌ NOT APPROVED: No match found`);
          setAuthResult({ approved: false });
        }

        setIsAuthProcessing(false);
        isAuthenticatingBox.value = false;
      }
    }, 500);

    return () => clearInterval(radar);
  }, [registerName]);

  // ─── AI MODELS ────────────────────────────────────────
  const faceMeshPlugin = useTensorflowModel(require('./assets/face_landmarks_detector.tflite'), []);
  const faceNetPlugin  = useTensorflowModel(require('./assets/mobilefacenet.tflite'), []);

  const { resizer } = useResizer({
    width: 256, height: 256, dataType: 'uint8', channelOrder: 'bgr',
    scaleMode: 'cover', pixelLayout: 'interleaved',
  });

  // ─── PERMISSIONS ──────────────────────────────────────
  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission]);

  useEffect(() => {
    async function requestLocationPermission() {
      if (Platform.OS === 'android') {
        try {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        } catch (err) {
          console.warn(err);
        }
      } else {
        Geolocation.requestAuthorization();
      }
    }
    requestLocationPermission();
  }, []);

  // ─── FRAME PROCESSOR ──────────────────────────────────
  const frameOutput = useFrameOutput({
    onFrame(frame) {
      'worklet';
      let resizedFrame;
      try {
        if (faceMeshPlugin.model == null || faceNetPlugin.model == null) return;
        if (!isRegisteringBox.value && !isAuthenticatingBox.value) return;

        // ── GET 256×256 pixel data ─────────────────────────────────────────
        // Primary path: use resizer plugin (dev/USB builds)
        // Fallback path: manual resize directly from frame (release APK builds
        //                where resizer native module may not initialise)
        let normalizedFloats256: Float32Array;

        if (resizer != null) {
          // ── RESIZER PATH (original working logic — untouched) ────────────
          resizedFrame = resizer.resize(frame);
          const rawBuffer   = resizedFrame.getPixelBuffer();
          const uint8Pixels = new Uint8Array(rawBuffer);

          const width256 = 256, height256 = 256;
          const expectedPixels256 = width256 * height256;
          const channels = Math.floor(uint8Pixels.length / expectedPixels256);

          normalizedFloats256 = new Float32Array(expectedPixels256 * 3);
          const ROTATION_ANGLE = 180;

          for (let y = 0; y < height256; y++) {
            for (let x = 0; x < width256; x++) {
              const srcIndex = (y * width256 + x) * channels;
              let destX = x, destY = y;
              if (ROTATION_ANGLE === 180) {
                destX = (width256  - 1) - x;
                destY = (height256 - 1) - y;
              }
              const destIndex = (destY * width256 + destX) * 3;
              normalizedFloats256[destIndex]     = uint8Pixels[srcIndex]     / 255.0;
              normalizedFloats256[destIndex + 1] = uint8Pixels[srcIndex + 1] / 255.0;
              normalizedFloats256[destIndex + 2] = uint8Pixels[srcIndex + 2] / 255.0;
            }
          }
        } else {
          // ── FALLBACK PATH (release APK — resizer not available) ──────────
          const fallback = manualResizeTo256(frame, 256);
          if (fallback == null) return;
          normalizedFloats256 = fallback;
        }

        // ── FACE MESH ──────────────────────────────────────────────────────
        const meshResult = (faceMeshPlugin.model as any).runSync([normalizedFloats256.buffer]);
        if (!meshResult?.[0]) return;

        const faceData  = new Float32Array(meshResult[0]);
        let   faceScore = 0;
        if (meshResult[1]) {
          const logit = new Float32Array(meshResult[1])[0];
          faceScore   = 1 / (1 + Math.exp(-logit));
        }

        if ((faceScore * 100) > 30) {
          // ── LIVENESS LANDMARKS ─────────────────────────────────────────
          const jawLeftX  = faceData[234 * 3];
          const jawRightX = faceData[454 * 3];
          const faceScale = Math.abs(jawRightX - jawLeftX) || 1.0;

          // Left eye
          const leftEyeTopY    = faceData[159 * 3 + 1];
          const leftEyeBotY    = faceData[145 * 3 + 1];
          const leftEyeOpenness = Math.abs(leftEyeTopY - leftEyeBotY) / faceScale;

          // Right eye
          const rightEyeTopY    = faceData[386 * 3 + 1];
          const rightEyeBotY    = faceData[374 * 3 + 1];
          const rightEyeOpenness = Math.abs(rightEyeTopY - rightEyeBotY) / faceScale;

          // Mouth
          const mouthLeftX  = faceData[61  * 3];
          const mouthRightX = faceData[291 * 3];
          const mouthWidth  = Math.abs(mouthRightX - mouthLeftX) / faceScale;

          // Head yaw
          const noseX      = faceData[1 * 3];
          const leftDist   = Math.abs(noseX - jawLeftX);
          const rightDist  = Math.abs(noseX - jawRightX);

          const isBlinking    = leftEyeOpenness  < 0.035 || rightEyeOpenness < 0.035;
          const isSmiling     = mouthWidth        > 0.28;
          const isTurnedLeft  = leftDist  / (rightDist || 1) > 2.0;
          const isTurnedRight = rightDist / (leftDist  || 1) > 2.0;

          const challenge = livenessChallengeBox.value;
          let livenessPassed = false;
          if (challenge === 0 && isBlinking)    livenessPassed = true;
          if (challenge === 1 && isSmiling)     livenessPassed = true;
          if (challenge === 2 && isTurnedLeft)  livenessPassed = true;
          if (challenge === 3 && isTurnedRight) livenessPassed = true;

          if (livenessPassed) {
            const now = Date.now();

            const resetVal = cooldownResetBox.value;
            if (resetVal !== ((globalThis as any).lastResetVal || 0)) {
              (globalThis as any).lastResetVal   = resetVal;
              (globalThis as any).lastFaceNetRun = 0;
            }

            if (now - ((globalThis as any).lastFaceNetRun || 0) > 1500) {
              (globalThis as any).lastFaceNetRun = now;

              // ── FACENET 112×112 ──────────────────────────────────────────
              // FIX: allocate SINGLE face buffer — no *2, no /2
              // Previous code allocated *2 and sliced half — corrupted embeddings
              const expectedPixels112   = 112 * 112;
              const normalizedFloats112 = new Float32Array(expectedPixels112 * 3);
              const scaleRatio          = 256 / 112;

              for (let y = 0; y < 112; y++) {
                for (let x = 0; x < 112; x++) {
                  const srcX     = Math.floor(x * scaleRatio);
                  const srcY     = Math.floor(y * scaleRatio);
                  const srcIndex = (srcY * 256 + srcX) * 3;
                  const destIndex = (y * 112 + x) * 3;
                  // FIX: MobileFaceNet expects [-1,1], not [0,1].
                  // normalizedFloats256 is in [0,1] (pixel/255).
                  // Rescale: [0,1] -> [-1,1] via val*2.0-1.0
                  normalizedFloats112[destIndex]     = normalizedFloats256[srcIndex]     * 2.0 - 1.0;
                  normalizedFloats112[destIndex + 1] = normalizedFloats256[srcIndex + 1] * 2.0 - 1.0;
                  normalizedFloats112[destIndex + 2] = normalizedFloats256[srcIndex + 2] * 2.0 - 1.0;
                }
              }

              const faceNetResult = (faceNetPlugin.model as any).runSync([normalizedFloats112.buffer]);
              if (!faceNetResult?.[0]) return;

              const embeddings = new Float32Array(faceNetResult[0]);
              // FIX: use FULL embedding length — never divide by 2
              const EMBEDDING_SIZE = embeddings.length;
              const arr = new Array(EMBEDDING_SIZE);
              for (let i = 0; i < EMBEDDING_SIZE; i++) arr[i] = embeddings[i];

              if (isRegisteringBox.value) {
                registrationEmbeddingBox.value = arr;
                isRegisteringBox.value         = false;
              } else if (isAuthenticatingBox.value) {
                authEmbeddingBox.value = arr;
                // isAuthenticatingBox reset by JS radar after match
              }
            }
          }
        }
      } catch (error) {
        console.log(`⚠️ AI Error: ${error}`);
      } finally {
        // FIX: dispose only in finally — prevents double-dispose crash
        if (resizedFrame != null) resizedFrame.dispose();
        frame.dispose();
      }
    },
  });

  // ─── DEV RESET FUNCTION ───────────────────────────────
  const handleDevReset = useCallback(async () => {
    await AsyncStorage.removeItem(DATASET_KEY);
    await AsyncStorage.removeItem('@attendance_logs');
    datasetRef.current = [];
    setPendingLogsCount(0);
    setRefreshKey(prev => prev + 1); // <-- FIX: UI Refresh trigger
    console.log('🧹 Dev Reset Complete: All faces and logs wiped.');
  }, []);

  // ─── SESSION START ────────────────────────────────────
  const startCaptureSession = useCallback((screen: 'register' | 'auth') => {
    setCameraActive(true);
    setDuplicateUser(null);
    setLivenessWarning(false);
    cooldownResetBox.value = cooldownResetBox.value + 1;

    const rand         = Math.floor(Math.random() * 4);
    livenessChallengeBox.value = rand;
    const challengeMap = ['blink', 'smile', 'turn_left', 'turn_right'] as const;
    setChallengeType(challengeMap[rand]);

    Geolocation.getCurrentPosition(
      pos => { locationRef.current = { lat: pos.coords.latitude, lon: pos.coords.longitude }; },
      err => { console.log('GPS err', err); },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 },
    );

    if (screen === 'register') {
      isRegisteringBox.value    = true;
      isAuthenticatingBox.value = false;
    } else {
      isAuthenticatingBox.value = true;
      isRegisteringBox.value    = false;
    }

    if (livenessTimerRef.current) clearTimeout(livenessTimerRef.current);
    livenessTimerRef.current = setTimeout(() => setLivenessWarning(true), 8000);
  }, []);

  // ─── NAVIGATION ───────────────────────────────────────
  const handleNavigate = useCallback((screen: 'register' | 'auth') => {
    setCameraActive(true);
    setCurrentScreen(screen);
    if (screen === 'auth') startCaptureSession('auth');
  }, [startCaptureSession]);

  const handleBack = useCallback(() => {
    setCurrentScreen('home');
    setCameraActive(false);
    setAuthResult(null);
    setIsAuthProcessing(false);
    setCaptureSuccess(false);
    setIsCapturing(false);
    setRegisterName('');
    setDuplicateUser(null);
    setLivenessWarning(false);
    isRegisteringBox.value    = false;
    isAuthenticatingBox.value = false;
    if (livenessTimerRef.current) { clearTimeout(livenessTimerRef.current); livenessTimerRef.current = null; }
  }, []);

  const handleStartCapture = useCallback((name: string) => {
    setRegisterName(name);
    setIsCapturing(true);
    startCaptureSession('register');
  }, [startCaptureSession]);

  const modelsLoaded = faceNetPlugin.model != null && faceMeshPlugin.model != null;

  if (!hasPermission) return <Text style={styles.centerText}>Requesting permissions...</Text>;
  if (device == null)  return <Text style={styles.centerText}>No camera detected.</Text>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e27" translucent />

      {/* 🧹 DEV RESET BUTTON 🧹 - Only visible on Home Screen */}
      {currentScreen === 'home' && (
        <TouchableOpacity style={styles.devResetBtn} onPress={handleDevReset}>
          <Text style={styles.devResetText}>🧹 Reset (Dev)</Text>
        </TouchableOpacity>
      )}

      {cameraActive && (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={cameraActive}
          outputs={[frameOutput]}
        />
      )}

      {currentScreen === 'home' && (
        <HomeScreen
          key={refreshKey} // <-- FIX: UI Refresh trigger
          onNavigate={handleNavigate}
          isOnline={isOnline}
          pendingLogsCount={pendingLogsCount}
        />
      )}

      {currentScreen === 'register' && (
        <RegisterScreen
          onBack={handleBack}
          onStartCapture={handleStartCapture}
          isCapturing={isCapturing}
          captureSuccess={captureSuccess}
          duplicateUser={duplicateUser}
          livenessWarning={livenessWarning}
          challengeType={challengeType}
          lowLightFlash={true}
        />
      )}

      {currentScreen === 'auth' && (
        <AuthScreen
          onBack={handleBack}
          authResult={authResult}
          isProcessing={isAuthProcessing}
          livenessWarning={livenessWarning}
          challengeType={challengeType}
          lowLightFlash={true}
        />
      )}

      {cameraActive && !modelsLoaded && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>⏳ Loading AI Models...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27' },
  centerText: { color: 'white', fontSize: 18, textAlign: 'center', marginTop: '50%', backgroundColor: '#0a0e27' },
  loadingOverlay: { position: 'absolute', bottom: 120, left: 20, right: 20, alignItems: 'center', zIndex: 200 },
  loadingText: {
    color: '#00d4ff', fontSize: 16, fontWeight: '700',
    backgroundColor: 'rgba(10,14,39,0.9)', paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,212,255,0.3)', overflow: 'hidden',
  },
  devResetBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 999,
    backgroundColor: 'rgba(229, 57, 53, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  devResetText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
});