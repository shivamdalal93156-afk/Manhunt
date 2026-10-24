# Testing Strategy: GPS Manhunt

## 1. Unit Testing Matrix
Target: Pure algorithmic functions in `src/utils/geo.ts` and `src/engine/`.

- [ ] **Haversine Distance**: Verify accurate metric distance across multiple coordinate pairs.
- [ ] **Forward Azimuth Bearing**: Verify 0° (North), 90° (East), 180° (South), 270° (West) calculations.
- [ ] **Device Heading & Compass Math**:
  - Test wrapping around 0° / 360°.
  - Test negative heading inputs.
  - Test relative angle normalization `[-180, 180]` and `[0, 360)`.
- [ ] **Point-In-Circle Geofencing**: Check boundary intersection and distance-to-edge.
- [ ] **Point-In-Polygon Geofencing**: Ray-casting algorithm for custom polygonal play areas.
- [ ] **Authoritative Game State Engine**:
  - Valid transitions: `LOBBY -> COUNTDOWN -> ACTIVE -> FINISHED`.
  - Illegal transitions rejected: e.g. `LOBBY -> FINISHED` directly.
- [ ] **Catch Validation Logic**:
  - Distance $\le 15$m returns true.
  - Distance $> 20$m returns false.
  - Eliminated runners cannot be caught twice.

---

## 2. Integration & Multi-Client Testing
- Automated simulator to mock 2 to 4 concurrent players walking along GPS trajectories.
- Verify that Hunters receive periodic snapshot updates and runners receive correct relative bearings.
- Verify Stealth activation suppresses snapshots for the designated window.

---

## 3. Real Device Testing Checklist (Android / iOS)
- [ ] Permission prompts (Foreground vs Background).
- [ ] Screen lock / phone in pocket while running (Android Foreground Service verification).
- [ ] GPS accuracy degradation indoors vs outdoors.
- [ ] Network disconnect and reconnect synchronization.
