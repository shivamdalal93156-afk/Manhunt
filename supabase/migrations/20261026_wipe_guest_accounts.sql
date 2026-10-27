-- ====================================================================
-- MIGRATION: Wipe Guest Accounts & Enforce Registered Player Accounts
-- Run this in Supabase SQL Editor to inspect and purge legacy guests
-- ====================================================================

-- 1. INSPECT GUEST DATA (Safe count check before purging)
SELECT 
    COUNT(*) AS total_guest_profiles,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) AS recent_guests
FROM public.profiles
WHERE is_guest = TRUE;

-- 2. INSPECT GUEST PARTICIPATIONS IN LOBBIES / MATCHES
SELECT 
    COUNT(p.id) AS guest_player_records
FROM public.players p
JOIN public.profiles pr ON p.profile_id = pr.id
WHERE pr.is_guest = TRUE;

-- 3. CLEANUP SCRIPT (Purge orphan guest players and profiles)
-- Note: Cascade rules on public.players will clean up game references safely
BEGIN;

-- Remove player entries linked to guest profiles
DELETE FROM public.players
WHERE profile_id IN (
    SELECT id FROM public.profiles WHERE is_guest = TRUE
);

-- Delete guest profiles
DELETE FROM public.profiles
WHERE is_guest = TRUE;

COMMIT;

-- 4. VERIFY RESULTS
SELECT COUNT(*) AS remaining_guests FROM public.profiles WHERE is_guest = TRUE;
