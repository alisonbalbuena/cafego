# Project Context — Study Cafe / CafeGo

Read this before making changes. It explains the original idea, what's built, what
isn't, and non-obvious decisions/gotchas that cost real debugging time the first
time around.

## Original idea

Three features, in this priority order:

1. **Friends mode** — see which friends are at which cafe, tag study sessions by
   subject (Math, Chem, CS, etc.) so people can find friends to study with or just
   keep each other accountable.
2. **Friend-controlled screen-time lock** — inspired by [Brick](https://getbrick.com),
   a product that locks distracting apps until unlocked. The original ask was for a
   *friend* (not the phone owner) to remotely lock/unlock apps with a code, requiring
   admin-level phone permissions.
3. **Universal cafe loyalty program** — instead of one app per cafe (like Starbucks
   Stars), let *any* cafe start a rewards program in this app: points-per-dollar or
   punch-card (buy 10, 11th free).

### Feature 2 was scoped down — read this before touching it

True cross-device "friend remotely locks your phone" is **not achievable** as
originally envisioned:

- Apple's Screen Time / `FamilyControls` API is entitlement-gated to parental-control
  apps and only works within a Family Sharing parent-child pairing — not arbitrary
  friend pairs.
- Android's Device Admin API has similar Play Store restrictions for non-enterprise
  use.
- Brick's actual mechanism: a physical NFC tile the *phone owner* taps on their own
  phone to trigger a Focus/Screen Time automation. There's no remote friend-operated
  unlock in their design, because the platforms don't allow it.

**Agreed direction (not yet built):** self-lock with a passcode the friend enters
in person on your phone (option (a) from that discussion) — not a remote toggle from
the friend's own device. If you build this, don't attempt real cross-device MDM/
FamilyControls approaches; they'll hit a wall.

## Stack

- **Expo SDK 54** (downgraded from the default 57 at project start — SDK 54 was
  chosen deliberately, don't upgrade without reason), React Native 0.81.5, React 19.1,
  TypeScript.
- **Firebase**: Auth (email/password), Firestore, Storage. Project id `cafego-4baa5`.
  Config lives in `.env` (gitignored, not committed — see `.env.example` for the
  required keys).
- **Navigation**: `@react-navigation` — bottom tabs (Home, Study, Friends, Rewards,
  My Cafe if merchant), each tab is its own native-stack for sub-screens.
- Cafe seed data (`src/data/cafes.ts`, 67 real Gwinnett/Atlanta cafes with
  lat/lng/rating) came from the original repo's CSV
  (`cafe_market_data_gwinnett_atlanta.csv`) — that repo is data-analysis only
  (Jupyter notebook + static HTML finder), not app code; nothing else from it was
  reused.

## What's built

**Auth** — email/password sign up/login. Every user gets a `role` (`customer` |
`merchant`), a unique `loyaltyCode` (backfilled automatically for pre-existing
accounts via a self-healing check in `useAuth`), and optionally `merchantCafeId`.

**Friends mode** — manual check-in (pick cafe from search, tag a subject, start/end
session), friend requests by email, live feed of friends' active sessions.

**Loyalty program** — any of the 67 seeded cafes can be "claimed" (see verification
gate below), configured as punch-card or points-per-dollar with a reward
description. Customers see their progress and loyalty code in the Rewards tab;
merchants award/redeem via the customer's loyalty code from the My Cafe dashboard.

**Cafe content** — merchants can post announcements, manage an itemized menu,
upload menu photos (Firebase Storage), and link an external online menu. All visible
on a shared `CafeProfileScreen` (used both from Rewards-tab rows — display only, not
tappable, per explicit request — and from Home-tab search results, which *are*
tappable).

**Reviews** — four category star ratings (Ambience, Drinks, Prices, Environment,
rendered as ☕ emoji not stars — also per explicit request) plus an optional written
comment, one review per user per cafe (submitting again updates it — button label
flips to "Update review" once you have one). A separate "Friends' reviews" section
shows only reviews from your friends, above the full aggregate.

**Home tab** — search across all 67 cafes, live "studying now" (active friends),
merged recent-sessions feed (yours + friends', client-sorted), and announcements
from any cafe you have a loyalty relationship with (i.e. an existing
`rewardAccounts` doc).

**Map** — `expo-location` + `react-native-maps`. Shows your real location, all 67
cafes as pins, friends' active check-ins as green pins. **Native-only** — see gotcha
below.

**Cafe-claim verification** — claiming a cafe no longer grants instant ownership.
It creates a `cafePrograms` doc with `status: 'pending'` and sets
`users/{uid}.pendingCafeId`; the cafe stays invisible in the public Rewards list
and the claimer sees an "awaiting verification" message with contact info
(the developer's email/phone — hardcoded in `ClaimCafeScreen.tsx` as
`VERIFICATION_CONTACT`). **There is no in-app admin UI.** Approval is manual, done
directly in the Firebase console after actually verifying the person by phone/email:
1. Firestore → `cafePrograms/{cafeId}` → set `status` to `"approved"`.
2. Firestore → `users/{ownerUid}` → set `role: "merchant"` and
   `merchantCafeId: "<cafeId>"`.
Both fields update live in the app the moment they're changed (no redeploy needed).

## Data model (Firestore collections)

- `users/{uid}` — profile, role, loyaltyCode, merchantCafeId, pendingCafeId
  - `users/{uid}/friends/{friendUid}` — mutual friend subcollection
- `friendRequests/{id}`
- `studySessions/{id}`
- `cafePrograms/{cafeId}` — doc id matches the static cafe id from `data/cafes.ts`;
  has `status: 'pending' | 'approved'`, program type/thresholds, `menuImageUrls`,
  `onlineMenuUrl`
- `rewardAccounts/{cafeId}_{uid}` — composite key, one per customer per cafe
- `cafeAnnouncements/{id}`
- `menuItems/{id}`
- `cafeReviews/{cafeId}_{uid}` — composite key, one review per user per cafe

Full rules are in `firestore.rules` (Firestore) and `storage.rules` (Storage) at
the repo root — **both must be manually pasted into the Firebase console** (separate
tabs — Firestore Database → Rules, and Storage → Rules — it's easy to paste into the
wrong one, which has happened before and broke all reads).

## Non-obvious gotchas (please read before "fixing" these again)

- **`react-native-web`'s `Alert.alert()` is a complete no-op** — verified in the
  installed package source (`static alert() {}`). Every screen uses a `showAlert()`
  helper (`src/utils/alert.ts`) that falls back to `window.alert` on web. Don't call
  `Alert.alert` directly anywhere.
- **Firebase Auth persistence must branch on platform.** `getReactNativePersistence`
  crashes on web (the function doesn't exist in the web build); `firebase/config.ts`
  branches on `Platform.OS === 'web'` to use `browserLocalPersistence` instead.
- **`getReactNativePersistence` shows a `tsc` type error that isn't a real bug** —
  Firebase's package.json `exports` map resolves the `types` condition before
  `react-native`, so plain `tsc` picks the wrong type entry even though Metro
  resolves the real implementation correctly at runtime. It's suppressed with a
  `@ts-expect-error` and a comment explaining why — don't "fix" it by changing the
  import.
- **Avoid Firestore composite indexes** — several queries that combine a `where`
  equality filter with `orderBy` on a different field were deliberately rewritten to
  drop the `orderBy` and sort client-side instead, so this project needs zero
  manually-created Firestore indexes. If you add a new query, prefer the same
  pattern over creating an index.
- **`react-native-maps` has no web implementation** — it hard-crashes web bundling
  entirely (not just visually broken). Fixed via `MapScreen.web.tsx`, a stub Metro
  automatically substitutes when bundling for web (standard Expo platform-extension
  resolution). Any other native-only library added in the future may need the same
  treatment if it's reachable from a screen used on web.
- **Storage rules avoid cross-service `firestore.get()` calls** — an earlier version
  tried to verify cafe ownership from Storage rules by reading Firestore
  (`firestore.get(...)`), which reliably failed with a permission error (possibly a
  Blaze-plan-only feature, unconfirmed). Simplified to just `request.auth != null`;
  real protection still comes from the Firestore-side rule on `cafePrograms`, so this
  isn't a meaningful security gap.
- **Local dev, not Xcode.** Xcode's iOS Simulator was deliberately avoided (license
  friction) — development machine uses standalone Command Line Tools
  (`xcode-select -s /Library/Developer/CommandLineTools`) so `git` works, and
  testing happens on a real phone via Expo Go. If LAN connection to Metro fails,
  `npx expo start --tunnel` is the fallback (slower, but works around macOS Local
  Network permission / router client-isolation issues that came up before).
- **Two-account testing trick**: one account on a physical phone via Expo Go, a
  second account via `npm run web` in a browser tab on the same machine — both hit
  the same Firebase backend, no second device needed.

## Not yet built

- The friend-controlled screen-time lock (self-lock + friend-entered passcode
  version — see scoped-down explanation above).
- Any in-app admin UI for cafe-claim approval (currently manual, via Firebase
  console).
- Editing an existing menu item or loyalty-program config after creation (currently
  add/delete only, no update).
