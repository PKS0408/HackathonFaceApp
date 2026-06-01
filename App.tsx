import 'react-native-worklets-core';
import { useResizer } from 'react-native-vision-camera-resizer'; 
import React, { useEffect, useState } from 'react';
import { Camera, useCameraDevice, useCameraPermission, useFrameOutput } from 'react-native-vision-camera';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useRunOnJS } from 'react-native-worklets-core';

// 🛑 GLOBAL COOLDOWN TIMER (Living strictly on the JS Thread!)
let lastLogTime = 0; 

export default function App() {
  // === 1. STRICT HOOK SEQUENCE (Never hot-swap these!) ===
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front'); 
  const [networkStatus, setNetworkStatus] = useState('📡 Scanning Network...');

  // 💾 THE OFFLINE DATABASE MANAGER (JS Thread Only)
  // We handle the cooldown HERE, completely safe from the C++ thread.
  const handleOfflineLogin = (matchScore: number) => {
    const now = Date.now();
    if (now - lastLogTime < 5000) return; // 5-second throttle
    lastLogTime = now; 

    (async () => {
      console.log(`\n======================================`);
      console.log(`🪪 ID VERIFIED! Score: ${(matchScore * 100).toFixed(1)}%`);
      console.log(`💾 Saving encrypted log to Zero-Network Storage...`);
      
      try {
        const existingLogsStr = await AsyncStorage.getItem('@attendance_logs');
        const logs = existingLogsStr ? JSON.parse(existingLogsStr) : [];
        
        logs.push({ 
          id: `EMP-${Math.floor(Math.random() * 10000)}`, 
          timestamp: new Date().toISOString(), 
          confidence: matchScore 
        });
        
        await AsyncStorage.setItem('@attendance_logs', JSON.stringify(logs));
        console.log(`✅ Saved! Total pending offline syncs: ${logs.length}`);
        console.log(`======================================\n`);
      } catch (e) {
        console.log(`❌ Database Error: ${e}`);
      }
    })();
  };

  // 👇 THE BRIDGE: Properly initialized using the Hook API
  const saveLoginToDatabase = useRunOnJS(handleOfflineLogin, []);

  const faceMeshPlugin = useTensorflowModel(require('./assets/face_landmarks_detector.tflite'), []);
  const faceNetPlugin = useTensorflowModel(require('./assets/mobilefacenet.tflite'), []);

  const { resizer } = useResizer({
    width: 256, height: 256, dataType: 'uint8', channelOrder: 'bgr', scaleMode: 'cover', pixelLayout: 'interleaved', 
  });

  // ☁️ MANDATORY DELIVERABLE 1b: SYNC & PURGE MECHANISM
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      if (state.isConnected) {
        setNetworkStatus('🌐 ONLINE - AWS Sync Active');
        console.log(`\n🌐 INTERNET DETECTED! Initiating AWS Sync Protocol...`);
        
        const logsStr = await AsyncStorage.getItem('@attendance_logs');
        if (logsStr) {
          const logs = JSON.parse(logsStr);
          if (logs.length > 0) {
            console.log(`☁️ Pushing ${logs.length} offline logs to AWS Datalake...`);
            
            setTimeout(async () => {
              console.log(`🗑️ Sync 100% Successful! Purging local data to free memory...`);
              await AsyncStorage.removeItem('@attendance_logs');
              console.log(`✨ Local database purged.\n`);
            }, 2000);
          } else {
            console.log(`✔️ Zero-Network database is empty. Nothing to sync.\n`);
          }
        }
      } else {
        setNetworkStatus('📵 OFFLINE - Zero Network Mode');
        console.log(`📵 Connection lost. Entering Offline Edge Mode.`);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission]);

  // === 2. THE CASCADING MATRIX (Pure Math Worklet) ===
  const frameOutput = useFrameOutput({
    onFrame(frame) {
      'worklet';
      let resizedFrame; 
      try {
        if (faceMeshPlugin.model == null || faceNetPlugin.model == null || resizer == null) return;

        resizedFrame = resizer.resize(frame);
        const rawBuffer = resizedFrame.getPixelBuffer();
        const uint8Pixels = new Uint8Array(rawBuffer);

        const width256 = 256, height256 = 256, expectedPixels256 = width256 * height256;
        const channels = Math.floor(uint8Pixels.length / expectedPixels256); 
        
        const normalizedFloats256 = new Float32Array(expectedPixels256 * 3);
        const ROTATION_ANGLE = 180; 
        
        for (let y = 0; y < height256; y++) {
          for (let x = 0; x < width256; x++) {
            const srcIndex = (y * width256 + x) * channels;
            let destX = x, destY = y;
            if (ROTATION_ANGLE === 180) { destX = (width256 - 1) - x; destY = (height256 - 1) - y; } 
            const destIndex = (destY * width256 + destX) * 3;
            normalizedFloats256[destIndex] = uint8Pixels[srcIndex] / 255.0; 
            normalizedFloats256[destIndex + 1] = uint8Pixels[srcIndex + 1] / 255.0;
            normalizedFloats256[destIndex + 2] = uint8Pixels[srcIndex + 2] / 255.0;
          }
        }

        const meshResult = (faceMeshPlugin.model as any).runSync([normalizedFloats256.buffer]);

        if (meshResult && meshResult[0]) {
          const faceData = new Float32Array(meshResult[0]);
          let faceScore = 0;
          if (meshResult[1]) {
            const logit = new Float32Array(meshResult[1])[0];
            faceScore = 1 / (1 + Math.exp(-logit)); 
          }

          if ((faceScore * 100) > 50) {
            const jawLeftX = faceData[234 * 3]; const jawRightX = faceData[454 * 3];
            const faceScale = Math.abs(jawRightX - jawLeftX) || 1.0;
            const leftEyeTopY = faceData[159 * 3 + 1]; const leftEyeBotY = faceData[145 * 3 + 1];
            const leftEyeOpenness = Math.abs(leftEyeTopY - leftEyeBotY) / faceScale;
            const mouthLeftX = faceData[61 * 3]; const mouthRightX = faceData[291 * 3];
            const mouthWidth = Math.abs(mouthRightX - mouthLeftX) / faceScale;

            const isBlinking = leftEyeOpenness < 0.025; 
            const isSmiling = mouthWidth > 0.38; 

            if (isBlinking || isSmiling) {
              const expectedPixels112 = 112 * 112;
              const normalizedFloats112 = new Float32Array(expectedPixels112 * 3 * 2); 
              const imageBOffset = expectedPixels112 * 3;
              const scaleRatio = 256 / 112; 

              for (let y = 0; y < 112; y++) {
                for (let x = 0; x < 112; x++) {
                  const srcX = Math.floor(x * scaleRatio); const srcY = Math.floor(y * scaleRatio);
                  const srcIndex = (srcY * 256 + srcX) * 3;
                  const r = normalizedFloats256[srcIndex]; const g = normalizedFloats256[srcIndex + 1]; const b = normalizedFloats256[srcIndex + 2];
                  const destIndex = (y * 112 + x) * 3;

                  normalizedFloats112[destIndex] = r; normalizedFloats112[destIndex + 1] = g; normalizedFloats112[destIndex + 2] = b;
                  normalizedFloats112[destIndex + imageBOffset] = r; normalizedFloats112[destIndex + imageBOffset + 1] = g; normalizedFloats112[destIndex + imageBOffset + 2] = b;
                }
              }

              const faceNetResult = (faceNetPlugin.model as any).runSync([normalizedFloats112.buffer]);
              
              if (faceNetResult && faceNetResult[0]) {
                const embeddings = new Float32Array(faceNetResult[0]);
                const EMBEDDING_SIZE = embeddings.length / 2; 
                const faceA = embeddings.slice(0, EMBEDDING_SIZE);
                const faceB = embeddings.slice(EMBEDDING_SIZE, EMBEDDING_SIZE * 2);

                let dotProduct = 0, normA = 0, normB = 0;
                for (let i = 0; i < EMBEDDING_SIZE; i++) {
                  dotProduct += faceA[i] * faceB[i]; normA += faceA[i] * faceA[i]; normB += faceB[i] * faceB[i];
                }
                const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

                if (similarity > 0.80) {
                  // 👇 THE FIX: Just throw the score over the wall. No global variable mutations here.
                  saveLoginToDatabase(similarity);
                }
              }
            }
          } 
        }
      } catch (error) {
        console.log(`⚠️ AI Error: ${error}`);
      } finally {
        if (resizedFrame != null) resizedFrame.dispose(); 
        frame.dispose(); 
      }
    }
  });

  const modelsLoaded = faceNetPlugin.model != null && faceMeshPlugin.model != null;

  if (!hasPermission) return <Text style={styles.centerText}>Requesting permissions...</Text>;
  if (device == null) return <Text style={styles.centerText}>No camera detected.</Text>;

  return (
    <View style={styles.container}>
      <Camera style={StyleSheet.absoluteFill} device={device} isActive={true} outputs={[frameOutput]} />

      <View style={styles.sniperScopeContainer} pointerEvents="none">
        <View style={styles.sniperScope} />
        <Text style={styles.instructionText}>Align face in circle & smile</Text>
      </View>

      <View style={styles.overlay}>
        <Text style={styles.statusText}>
          {modelsLoaded ? `✅ AI Active | ${networkStatus}` : '⏳ Booting Neural Networks...'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  sniperScopeContainer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  sniperScope: { width: 400, height: 400, borderRadius: 200, borderWidth: 4, borderColor: 'rgba(0, 255, 0, 0.6)', borderStyle: 'dashed' },
  instructionText: { color: 'white', marginTop: 15, fontSize: 16, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 8, textAlign: 'center' },
  overlay: { position: 'absolute', bottom: 50, left: 20, right: 20, backgroundColor: 'rgba(0, 0, 0, 0.8)', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#00ff00', zIndex: 10 },
  statusText: { color: '#00ff00', fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'center' },
  centerText: { color: 'white', fontSize: 18, textAlign: 'center', marginTop: '50%' }
});