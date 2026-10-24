# Location & Data Privacy Policy: GPS Manhunt

## 1. Principles of Location Privacy

1. **Explicit Operational Purpose**: GPS location data is collected **only** while the user is participating as an active player in a live game (`status = ACTIVE` or `COUNTDOWN`).
2. **Zero Inactive Tracking**: Tracking services (both foreground and background tasks) are halted immediately when:
   - The user leaves or forfeits the match.
   - The match status changes to `FINISHED` or `PAUSED`.
   - The user revokes location permissions.
3. **Transient Data Retention**:
   - Location points and movement tracks are stored temporarily in Postgres during the active match.
   - A scheduled cleanup worker automatically purges all records in `player_locations`, `location_visibility_snapshots`, and `chat_messages` 5 minutes after match completion.
4. **Android Foreground Service Compliance**:
   - Android requires a persistent foreground notification when tracking background GPS.
   - Notification text: *"GPS Manhunt match is active - tracking position for game rules"*.
   - A prominent "LEAVE GAME & STOP TRACKING" button is available directly from the app HUD.
5. **Role-Based Asymmetry**:
   - Raw location coordinates are never distributed to opposing players.
   - Runners never stream hunter GPS coordinates, maintaining parity with privacy and fair gameplay.
