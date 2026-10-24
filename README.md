# GPS Manhunt — Real-Life Outdoor Multiplayer Chase Game

An original, authoritative real-time multiplayer mobile game where players turn outdoor parks, campuses, and neighborhoods into an active playing field. 

Inspired by the core mechanics of real-life GPS manhunts:
- **Hunters (Chasers)** track runners via tactical radar maps with periodic location snapshots.
- **Runners** navigate using a high-precision directional geodesic compass and tactical evasive power-ups (Stealth, Decoy, Map View).
- **Referees** monitor safety and enforce geofenced boundaries.

---

## Key Features

1. **Authoritative Anti-Cheat Game Engine**: Match timers, catch proximity checks, state transitions, and power-up cooldowns are authoritatively computed on the server.
2. **Zero-Leak Location Privacy**: Opponent raw GPS coordinates are never distributed across the wire. Hunters receive only authorized periodic snapshots; Runners receive relative geodesic bearings without revealing exact hunter positions.
3. **Dynamic Geofenced Play Zones**: Circle and polygon boundary mapping with out-of-bounds warning grace zones and optional shrinking play zones.
4. **Offline & Drift Resilient**: Multi-sample GPS filtering, magnetometer-to-course fallback, and seamless state re-synchronization upon network interruption.
5. **High-Contrast Outdoor HUD**: Premium dark-mode interface designed for quick readability in bright sunlight and low distraction while running.

---

## Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v18+ (tested on v24)
- npm or yarn
- Expo Go app on mobile (or Android/iOS Simulator)

### 2. Setup
```bash
git clone <repo-url>
cd manhunt
npm install
cp .env.example .env
```

### 3. Run Development Server
```bash
npx expo start
```
Scan the QR code with your phone using Expo Go or run on an emulator (`a` for Android).

---

## Documentation Index
- [Reference Product Research](file:///c:/Users/SHIVAM/Desktop/manhunt/docs/REFERENCE_RESEARCH.md)
- [System Architecture](file:///c:/Users/SHIVAM/Desktop/manhunt/docs/ARCHITECTURE.md)
- [Game Rules & Mechanics](file:///c:/Users/SHIVAM/Desktop/manhunt/docs/GAME_RULES.md)
- [Database Schema & RLS](file:///c:/Users/SHIVAM/Desktop/manhunt/docs/DATABASE_SCHEMA.md)
- [API & Realtime Contracts](file:///c:/Users/SHIVAM/Desktop/manhunt/docs/API_CONTRACTS.md)
- [Location & Data Privacy](file:///c:/Users/SHIVAM/Desktop/manhunt/docs/LOCATION_PRIVACY.md)
- [Testing Strategy](file:///c:/Users/SHIVAM/Desktop/manhunt/docs/TESTING.md)
- [Deployment Guide](file:///c:/Users/SHIVAM/Desktop/manhunt/docs/DEPLOYMENT.md)
- [Known Limitations](file:///c:/Users/SHIVAM/Desktop/manhunt/docs/KNOWN_LIMITATIONS.md)
