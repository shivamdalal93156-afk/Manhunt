# Known Limitations & Native Boundaries: GPS Manhunt

## 1. Expo Go vs Development Builds (Background Tracking)
- **Limitation**: The standard `Expo Go` client sandbox has restricted permissions for long-running Android Foreground Services and background location tasks (`expo-location.startLocationUpdatesAsync`).
- **Mitigation / Architecture**:
  - The application includes an in-app GPS fallback mode for local testing in Expo Go / Web / Simulator.
  - For full background tracking (allowing players to run with screens locked in pockets), a development build (`npx expo run:android` or EAS Build) is required.

## 2. GPS Drift & Urban Canyons
- **Limitation**: Between tall buildings or indoors, consumer phone GPS can drift by 20-50 meters, potentially triggering false boundary violations or inaccurate catches.
- **Mitigation**:
  - Distance threshold grace margin (+5m on catch radius).
  - Out-of-bounds trigger requires 2 consecutive readings outside the boundary radius with accuracy $< 25$m.

## 3. Magnetometer Calibration
- **Limitation**: Compass heading may experience interference near large metal structures or high-voltage lines.
- **Mitigation**:
  - The compass HUD displays a calibration warning when the device sensor reports uncalibrated status.
  - Fallback to GPS course vector when player is moving $> 1.2$ m/s.
