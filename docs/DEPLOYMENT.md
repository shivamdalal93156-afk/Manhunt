# Deployment & Setup Guide: GPS Manhunt

## Prerequisites
- Node.js >= 18 (installed: v24.x)
- npm or yarn
- Expo CLI (`npx expo`)
- Supabase account or local Supabase CLI (`npx supabase`)

## Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Populate:
- `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase Project URL.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Public Anonymous Key.
- `EXPO_PUBLIC_MAPBOX_TOKEN` (Optional if using default OpenStreetMap tiles).

## Running Migrations
If using Supabase CLI:
```bash
npx supabase db push
```
Or execute the SQL commands found in `docs/DATABASE_SCHEMA.md` in the Supabase SQL Editor.

## Starting the Mobile App
```bash
npm install
npx expo start
```
- Press `a` for Android Emulator or connect via Expo Go on physical device.
- For background location testing on Android, an EAS development build or native prebuild is required (`npx expo run:android`).
