# Phase 7 Plan: Polish, Accessibility, and Launch Readiness

**Version target:** 0.7.0  
**Goal:** Final production-ready polish: localization, accessibility, player onboarding, achievements, and graceful operational features.

---

## 7A — Localization & Internationalization (i18n)
**File:** `client/localization.js`  
**Test:** `test/milestone7a.test.js`

- **String table loader:** Load JSON locale files from `data/locales/` (e.g., `en.json`, `no.json`).
- **Interpolator:** Simple `{key}` substitution with `t('key', {count: 5})`.
- **Locale switching:** `setLocale('no')` updates the active dictionary; missing keys fall back to `en`.
- **Pluralization rules:** English-only for now (one/other), but structured to support ICU-style `zero/one/other`.
- **Export list:** `loadLocale`, `t`, `setLocale`, `getLocale`, `registerLocale`.

**Constraints:** No external i18n libraries. Pure JSON dictionaries, deterministic lookups, zero runtime mutation of the dictionary object.

---

## 7B — Accessibility Suite
**File:** `client/accessibility.js`  
**Test:** `test/milestone7b.test.js`

- **Colorblind mode filters:** Protanopia, Deuteranopia, Tritanopia simulation matrices (3×3 RGB multipliers) applied as CSS variables or canvas filters. The logic is pure math.
- **High contrast toggle:** Boolean flag that toggles a palette swap for terrain/unit colors (pure function `applyHighContrast(colors) -> colors`).
- **Screen reader announcements:** Queue-based `ariaLive` message system; `announce('Tank destroyed')` pushes to a ring buffer.
- **Input remapping validator:** Ensure no duplicate keybinds, no reserved keys (Tab, Escape). Pure validation function.

**Export list:** `COLORBLIND_MATRICES`, `applyColorblindFilter`, `applyHighContrast`, `announceMessage`, `validateKeybinds`.

---

## 7C — Achievement & Progression System
**File:** `server/achievements.js`  
**Test:** `test/milestone7c.test.js`

- **Achievement registry:** Define achievements with `id`, `name`, `description`, `condition(state, playerId)`, `reward`.
- **Condition evaluator:** Check unlock conditions against match state (e.g., `"win_without_losing_units"`, `"kill_10_in_one_match"`).
- **Player progress store:** JSON file per player (`data/players/{playerId}/achievements.json`) tracking unlocked IDs and timestamps.
- **Reward grants:** Cosmetic-only (titles, badges) — no gameplay-affecting rewards to preserve balance.
- **Progression tiers:** Bronze/Silver/Gold tiers based on cumulative match counts.

**Export list:** `registerAchievement`, `checkAchievements`, `getPlayerProgress`, `unlockAchievement`, `ACHIEVEMENT_REGISTRY`.

---

## 7D — Tutorial & Onboarding Engine
**File:** `client/tutorial.js`  
**Test:** `test/milestone7d.test.js`

- **Tutorial step sequencer:** Array of steps with `trigger`, `highlight`, `message`, `actionRequired`. Steps progress deterministically based on player actions.
- **Trigger evaluator:** Pure function `evaluateTrigger(step, gameState) -> bool`.
- **Hint system:** Contextual hints when a player idles for >20 ticks (e.g., "Try moving your unit").
- **Completion tracker:** Persist tutorial completion in localStorage so returning players skip it.
- **Mock / headless mode:** The sequencer can run against a simulated state object for tests.

**Export list:** `createTutorial`, `advanceStep`, `evaluateTrigger`, `isTutorialComplete`, `resetTutorial`.

---

## 7E — Launch Config & Operational Grace
**File:** `server/launch_config.js`  
**Test:** `test/milestone7e.test.js`

- **Health check endpoint:** Expose a `getHealth()` function that returns `status: 'ok' | 'degraded' | 'down'` based on tick loop lag, memory, and last successful snapshot save.
- **Graceful shutdown handler:** Drain active connections, flush pending telemetry, save all match states before exiting. Pure state machine logic (no process.on in the slice itself — exported handler).
- **Rate limit config:** Pure function `createRateLimit(windowMs, maxRequests) -> counter` for use in WebSocket upgrade handlers.
- **Feature flags:** `isFeatureEnabled(flagName, rolloutPercentage, playerIdHash)` using deterministic hashing (FNV-1a) to enable gradual rollouts without external flag services.
- **Version manifest:** Expose `getVersion()` returning `version`, `commit`, `buildDate` from `package.json`.

**Export list:** `getHealth`, `createShutdownSequence`, `createRateLimit`, `isFeatureEnabled`, `getVersion`.

---

## Phase 7 Success Criteria
- All 5 slices (7A–7E) pass with 100% test coverage of their exported functions.
- No new external dependencies beyond the existing deterministic stack.
- All slices must list every export explicitly; no test imports an un-exported name.
- Final version bump to `0.7.0` marks the project as feature-complete for the v1.0 roadmap.

---

## Cross-Cutting Concerns
1. **Security:** 7C achievement writes must validate `playerId` against an auth token (mocked in tests). 7E rate limits are pure counters — enforcement happens in the WebSocket layer.
2. **Determinism:** 7A, 7B, and 7D are client-side pure logic. 7C and 7E are server-side but operate on immutable state snapshots.
3. **Performance:** 7A string lookups are O(1) via object key access. 7B color matrices are pre-computed constants. 7C achievement checks run once per match end, not per tick.
