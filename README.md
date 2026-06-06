# DatalakeFace 📱🔒

Offline facial recognition and 3D liveness detection built for **Datalake 3.0** during Hackathon 7.0.

## The Challenge
We needed to authenticate field workers in zero-network zones using standard mid-range phones (3GB RAM). The hardest constraint? We couldn't bloat the existing React Native app, meaning the entire AI footprint had to stay strictly under 20MB while processing faces in under a second. 

## How We Built It
Instead of relying on heavy cloud APIs or bloated 3rd-party image processing SDKs, we built a 100% offline edge-AI pipeline. We used React Native, Vision Camera, and Worklets to run everything natively on the device hardware.

### 1. Ultra-Lightweight Footprint (~5MB Total)
To hit the sub-20MB target for the innovation criteria, we dropped heavy image-resizer plugins. Instead, we wrote a custom C++ Worklet that directly reads the raw Android `Uint8Array` camera buffer and downsamples the pixels mathematically. 
* **FaceMesh (`~1.2MB`):** Tracks 468 facial landmarks.
* **MobileFaceNet (`~4.0MB`):** Generates 128-D embeddings for the actual match.
* **Result:** Our total AI bloat is ~5.2MB, keeping us 75% below the strict 20MB limit.

### 2. 3D Liveness Detection (Anti-Spoofing)
We don't just crop a face and check it. The app forces the user to prove they are human by randomly asking them to blink, smile, or turn their head. The FaceMesh model tracks the geometric distances between the eyes, nose, and jawline at 60FPS to catch the movement, completely blocking photo or screen spoofing.

### 3. Zero-Latency Execution (< 1s)
Because we used `react-native-worklets-core`, the entire pipeline (Camera capture → Downsampling → Liveness check → Cosine similarity match) happens on a background C++ thread. The main JavaScript UI thread never blocks, making it incredibly fast even on older Android/iOS devices.

### 4. Zero-Network AWS Sync
If the user is offline, the app encrypts the match score, timestamp, and GPS coordinates into `AsyncStorage`. A background `NetInfo` radar constantly listens for a connection. The exact second the phone hits Wi-Fi or cellular data, it bulk-pushes all pending logs to the AWS Datalake and immediately purges the local cache.

---
