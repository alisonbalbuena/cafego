import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import {
  addDoc,
  collection,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  updateDoc,
  doc,
  where,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { db, storage } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { useActiveSession } from '../hooks/useActiveSession';
import { CAFES, HOME_LOCATION } from '../data/cafes';
import { UI_ICONS } from '../data/uiIcons';
import { COFFEE_FRIENDS, getCoffeeFriend } from '../data/coffeeFriends';
import { randomBuddyPose } from '../data/buddyPoses';
import BuddyPhotoEditor, { BuddyPhotoResult } from '../components/BuddyPhotoEditor';
import PixelBean from '../components/PixelBean';
import { getLocationAdventureMessage } from '../utils/buddyJourney';
import { postBuddyAdventure } from '../utils/buddyPosts';
import { logStudySessionToCalendar } from '../utils/calendarSync';
import { applyShield, removeShield } from 'screen-time';
import {
  endStudyTimerActivity,
  startStudyTimerActivity,
  updateStudyTimerActivity,
} from 'study-timer-activity';
import { getPhaseLabel, getPhaseRemainingMs } from '../utils/studyMethodTimer';
import {
  BusynessLevel,
  BUSYNESS_LEVELS,
  busynessMeta,
  Cafe,
  getSessionSubjectSegments,
  intensityMeta,
  SessionVisibility,
  StudyBuddy,
  StudyIntensity,
  StudyMethod,
  StudyMode,
  StudySession,
  STUDY_INTENSITIES,
  STUDY_METHODS,
  VISIBILITY_LEVELS,
  visibilityMeta,
} from '../types';
import { showAlert } from '../utils/alert';
import { COLORS, FONTS } from '../theme';
import { distanceMiles } from '../utils/geo';
import { isAllNighter } from '../utils/allNighter';
import { monthKey, startOfMonth, startOfWeek } from '../utils/dateHelpers';
import { formatMoney } from '../utils/format';
import { getRemainingSyncExits } from '../utils/syncExitLimit';
import { incrementPairStats } from '../utils/pairStats';
import { isGooglePlacesConfigured, searchCafesByText, searchNearbyCafes } from '../utils/googlePlaces';
import { computeStreakCoins } from '../utils/streakCoins';
import { useRefresh } from '../hooks/useRefresh';
import SearchBar from '../components/SearchBar';
import CoffeeMugTimer from '../components/CoffeeMugTimer';
import StudyMethodTimer from '../components/StudyMethodTimer';

interface Friend {
  uid: string;
  displayName: string;
  username?: string;
}

export default function CheckInScreen({ navigation, route }: any) {
  const { user, profile } = useAuth();
  const { session: activeSession } = useActiveSession();
  const { refreshing, onRefresh } = useRefresh();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [subjectDraft, setSubjectDraft] = useState('');
  const [visibility, setVisibility] = useState<SessionVisibility>('public');
  const [intensity, setIntensity] = useState<StudyIntensity>('working');
  const [studyMode, setStudyMode] = useState<StudyMode>('solo');
  const [studyMethod, setStudyMethod] = useState<StudyMethod>('custom');
  const [timeboxMinutes, setTimeboxMinutes] = useState('45');
  const [customTotalMinutes, setCustomTotalMinutes] = useState('120');
  const [customWorkMinutes, setCustomWorkMinutes] = useState('25');
  const [customBreakMinutes, setCustomBreakMinutes] = useState('5');
  const [customBreakCount, setCustomBreakCount] = useState('3');
  const [taggedFriends, setTaggedFriends] = useState<StudyBuddy[]>([]);
  const [friendTagSearch, setFriendTagSearch] = useState('');
  const [wantSync, setWantSync] = useState(false);
  const [partnerSession, setPartnerSession] = useState<StudySession | null>(null);
  const [partnerLeftBanner, setPartnerLeftBanner] = useState<{ name: string; reason?: string } | null>(
    null
  );
  const [showExitReason, setShowExitReason] = useState(false);
  const [exitReasonDraft, setExitReasonDraft] = useState('');
  const partnerSessionIdRef = useRef<string | null>(null);
  const completingSyncRef = useRef(false);
  const [spentMoney, setSpentMoney] = useState<'yes' | 'no' | null>(null);
  const [amountSpent, setAmountSpent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorPoseId, setEditorPoseId] = useState('idle');
  const [buddyPhotoResult, setBuddyPhotoResult] = useState<BuddyPhotoResult | null>(null);
  const [cafeActiveSessions, setCafeActiveSessions] = useState<StudySession[]>([]);
  const [liveNearbyCafes, setLiveNearbyCafes] = useState<Cafe[] | null>(null);
  const [liveSearchCafes, setLiveSearchCafes] = useState<Cafe[] | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(
      collection(db, 'users', user.uid, 'friends'),
      (snapshot) => setFriends(snapshot.docs.map((d) => d.data() as Friend))
    );
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    setSubjectDraft(activeSession?.subject ?? '');
  }, [activeSession?.id, activeSession?.subject]);

  useEffect(() => {
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return;
      const position = await Location.getCurrentPositionAsync({});
      setLocation(position);
    })();
  }, []);

  useEffect(() => {
    const confirmedCafe = route?.params?.confirmedCafe;
    if (!confirmedCafe) return;
    setSelectedCafe(confirmedCafe);
    navigation.setParams({ confirmedCafe: undefined });
  }, [route?.params?.confirmedCafe]);

  useEffect(() => {
    if (!location || !isGooglePlacesConfigured()) return;
    searchNearbyCafes(location.coords.latitude, location.coords.longitude).then((cafes) => {
      if (cafes.length > 0) setLiveNearbyCafes(cafes);
    });
  }, [location]);

  useEffect(() => {
    const term = search.trim();
    if (!term || !location || !isGooglePlacesConfigured()) {
      setLiveSearchCafes(null);
      return;
    }
    const timeout = setTimeout(() => {
      searchCafesByText(term, location.coords.latitude, location.coords.longitude).then(
        setLiveSearchCafes
      );
    }, 400);
    return () => clearTimeout(timeout);
  }, [search, location]);

  useEffect(() => {
    if (!activeSession || activeSession.cafeId === HOME_LOCATION.id) {
      setCafeActiveSessions([]);
      return;
    }
    const q = query(
      collection(db, 'studySessions'),
      where('cafeId', '==', activeSession.cafeId),
      where('endedAt', '==', null)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCafeActiveSessions(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    return unsubscribe;
  }, [activeSession?.cafeId]);

  useEffect(() => {
    completingSyncRef.current = false;
    partnerSessionIdRef.current = null;
    setPartnerSession(null);
    setPartnerLeftBanner(null);
  }, [activeSession?.id]);

  useEffect(() => {
    const partnerUid = activeSession?.syncPartnerUid;
    if (!partnerUid) {
      setPartnerSession(null);
      return;
    }
    const q = query(
      collection(db, 'studySessions'),
      where('uid', '==', partnerUid),
      where('endedAt', '==', null)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        const lastId = partnerSessionIdRef.current;
        partnerSessionIdRef.current = null;
        setPartnerSession(null);
        if (lastId) {
          getDoc(doc(db, 'studySessions', lastId)).then((d) => {
            if (!d.exists()) return;
            const data = d.data() as any;
            if (data.syncPartnerUid === user?.uid) {
              setPartnerLeftBanner({ name: data.displayName, reason: data.syncExitReason });
            }
          });
        }
        return;
      }
      const d = snapshot.docs[0];
      partnerSessionIdRef.current = d.id;
      setPartnerSession({ id: d.id, ...(d.data() as any) });
      setPartnerLeftBanner(null);
    });
    return unsubscribe;
  }, [activeSession?.syncPartnerUid, user?.uid]);

  const isSynced = !!(
    activeSession?.syncPartnerUid &&
    partnerSession?.syncPartnerUid === user?.uid
  );

  const remainingSyncExits = getRemainingSyncExits(
    profile?.syncExitCount,
    profile?.syncExitMonthKey,
    monthKey(Date.now())
  );

  useEffect(() => {
    if (!isSynced || !activeSession || !user) return;
    if (!activeSession.syncReadyToUnlock || !partnerSession?.syncReadyToUnlock) return;
    if (completingSyncRef.current) return;
    completingSyncRef.current = true;
    finalizeMutualCompletion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSynced, activeSession?.syncReadyToUnlock, partnerSession?.syncReadyToUnlock]);

  const friendsAtCafe = useMemo(() => {
    const friendUids = new Set(friends.map((f) => f.uid));
    return cafeActiveSessions.filter((s) => s.uid !== user?.uid && friendUids.has(s.uid));
  }, [cafeActiveSessions, friends, user]);

  const baseCafes = liveNearbyCafes ?? CAFES;

  const sortedCafes = useMemo(() => {
    if (!location) return baseCafes.map((c) => ({ ...c, distance: undefined as number | undefined }));
    const { latitude, longitude } = location.coords;
    return [...baseCafes]
      .map((c) => ({ ...c, distance: distanceMiles(latitude, longitude, c.lat, c.lng) }))
      .sort((a, b) => a.distance - b.distance);
  }, [location, baseCafes]);

  const showingRecommended = !search.trim() && !!location;

  const filteredCafes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return location ? sortedCafes.slice(0, 5) : sortedCafes;
    if (liveSearchCafes !== null) {
      return liveSearchCafes.map((c) => ({ ...c, distance: undefined as number | undefined }));
    }
    return sortedCafes.filter(
      (c) =>
        c.name.toLowerCase().includes(term) || c.neighborhood.toLowerCase().includes(term)
    );
  }, [search, sortedCafes, location, liveSearchCafes]);

  const filteredFriendsForTag = useMemo(() => {
    const term = friendTagSearch.trim().toLowerCase();
    if (!term) return friends;
    return friends.filter(
      (f) =>
        f.displayName.toLowerCase().includes(term) ||
        (f.username ?? '').toLowerCase().includes(term)
    );
  }, [friends, friendTagSearch]);

  const toggleTaggedFriend = (friend: Friend) => {
    setTaggedFriends((prev) =>
      prev.some((f) => f.uid === friend.uid)
        ? prev.filter((f) => f.uid !== friend.uid)
        : [...prev, { uid: friend.uid, displayName: friend.displayName }]
    );
  };

  const activeCoffeeFriend = getCoffeeFriend(profile?.activeCoffeeFriend) ?? COFFEE_FRIENDS[0];
  const buddyName = profile?.buddyName ?? activeCoffeeFriend.name;

  const takeCheckInPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showAlert('Camera access needed', 'Allow camera access to take a check-in photo with your buddy.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    setCapturedPhotoUri(result.assets[0].uri);
    setEditorPoseId(randomBuddyPose().id);
    setEditorVisible(true);
  };

  const removeCheckInPhoto = () => {
    setBuddyPhotoResult(null);
    setCapturedPhotoUri(null);
  };

  const uploadCheckInPhoto = async (sessionId: string, cafeName: string, photo: BuddyPhotoResult) => {
    if (!user) return;
    try {
      const originalRef = ref(storage, `sessionPhotos/${user.uid}/${sessionId}/original.jpg`);
      const originalBlob = await (await fetch(photo.originalUri)).blob();
      await uploadBytes(originalRef, originalBlob);
      const update: Record<string, any> = {
        checkInPhotoUrl: await getDownloadURL(originalRef),
        buddyPoseId: photo.poseId,
      };
      if (photo.compositedUri) {
        const compositedRef = ref(storage, `sessionPhotos/${user.uid}/${sessionId}/composited.jpg`);
        const compositedBlob = await (await fetch(photo.compositedUri)).blob();
        await uploadBytes(compositedRef, compositedBlob);
        update.checkInPhotoWithBuddyUrl = await getDownloadURL(compositedRef);
      }
      await updateDoc(doc(db, 'studySessions', sessionId), update);
      // Share it to the buddy adventure feed too — reusing whichever photo we
      // already uploaded above rather than uploading it a second time.
      await postBuddyAdventure(user.uid, {
        displayName: user.displayName ?? 'Someone',
        buddyName,
        poseId: photo.poseId,
        cafeName,
        source: 'checkin',
        imageUrl: update.checkInPhotoWithBuddyUrl ?? update.checkInPhotoUrl,
      });
    } catch {
      // Best-effort — a photo upload failure should never undo a check-in.
    }
  };

  /** Reads *before* the new session is created, so "first visit" counts
   * naturally exclude the session about to be started. */
  const computeLocationAdventure = async (cafeId: string, cafeName: string) => {
    if (!user) return null;
    try {
      const q = query(collection(db, 'studySessions'), where('uid', '==', user.uid));
      const snapshot = await getDocs(q);
      let priorVisitsAtThisCafe = 0;
      const cafeIds = new Set<string>();
      snapshot.docs.forEach((d) => {
        const data = d.data() as any;
        cafeIds.add(data.cafeId);
        if (data.cafeId === cafeId) priorVisitsAtThisCafe += 1;
      });
      return getLocationAdventureMessage(cafeName, priorVisitsAtThisCafe, cafeIds.size);
    } catch {
      return null;
    }
  };

  const warnIfOverBudget = async () => {
    if (!user || !profile?.budgetAmount) return;
    try {
      const periodStart =
        profile.budgetPeriod === 'monthly' ? startOfMonth(Date.now()) : startOfWeek(Date.now());
      const q = query(collection(db, 'studySessions'), where('uid', '==', user.uid));
      const snapshot = await getDocs(q);
      const spent = snapshot.docs.reduce((sum, d) => {
        const data = d.data() as any;
        return data.startedAt >= periodStart ? sum + (data.amountSpent ?? 0) : sum;
      }, 0);
      const remaining = profile.budgetAmount - spent;
      const periodLabel = profile.budgetPeriod === 'monthly' ? 'month' : 'week';
      if (remaining >= 0) {
        showAlert(
          '☕ Budget check-in',
          `You've spent ${formatMoney(spent)} of your ${formatMoney(
            profile.budgetAmount
          )} ${periodLabel}ly budget — ${formatMoney(remaining)} left. Happy studying!`
        );
      } else {
        showAlert(
          '☕ Just a heads up',
          `You've spent ${formatMoney(spent)} this ${periodLabel}, which is ${formatMoney(
            Math.abs(remaining)
          )} over your ${formatMoney(profile.budgetAmount)} budget. No pressure — just keeping you in the loop!`
        );
      }
    } catch {
      // Best-effort nudge — never block starting a session over this.
    }
  };

  const startSession = async () => {
    const subject = selectedSubject.trim();
    if (!user || !selectedCafe || !subject) return;
    setSubmitting(true);
    try {
      const startedAt = Date.now();
      const payload: Record<string, any> = {
        uid: user.uid,
        displayName: user.displayName ?? 'Someone',
        cafeId: selectedCafe.id,
        cafeName: selectedCafe.name,
        cafeLat: selectedCafe.lat,
        cafeLng: selectedCafe.lng,
        subject,
        startedAt,
        endedAt: null,
        visibility,
        intensity,
        studyMode,
        subjectLog: [{ subject, startedAt, endedAt: null }],
      };
      if (profile?.community) {
        payload.community = profile.community;
      }
      if (studyMethod !== 'none') {
        const methodMeta = STUDY_METHODS.find((m) => m.value === studyMethod)!;
        payload.studyMethod = studyMethod;
        if (studyMethod === 'timeboxing') {
          payload.methodWorkMin = Math.max(1, Number(timeboxMinutes) || 45);
          payload.methodBreakMin = 0;
        } else if (studyMethod === 'custom') {
          payload.methodWorkMin = Math.max(1, Number(customWorkMinutes) || 25);
          payload.methodBreakMin = Math.max(1, Number(customBreakMinutes) || 5);
          payload.methodTotalMin = Math.max(1, Number(customTotalMinutes) || 120);
          payload.methodBreakCount = Math.max(0, Number(customBreakCount) || 0);
        } else {
          payload.methodWorkMin = methodMeta.workMin;
          payload.methodBreakMin = methodMeta.breakMin ?? 0;
        }
        payload.methodPhase = 'work';
        payload.methodPhaseStartedAt = startedAt;
        payload.methodRound = 1;
      }
      if (studyMode === 'group' && taggedFriends.length > 0) {
        payload.withFriends = taggedFriends;
      }
      if (studyMode === 'group' && wantSync && taggedFriends.length === 1) {
        payload.syncPartnerUid = taggedFriends[0].uid;
      }
      const adventure = await computeLocationAdventure(selectedCafe.id, selectedCafe.name);
      const sessionRef = await addDoc(collection(db, 'studySessions'), payload);
      warnIfOverBudget();
      if (profile?.screenTimeShieldEnabled) {
        applyShield().catch(() => {});
      }
      if (payload.studyMethod) {
        startStudyTimerActivity(selectedCafe.name, {
          subject,
          phaseLabel: getPhaseLabel('work'),
          phaseEndDate: startedAt + payload.methodWorkMin * 60000,
          remainingSeconds: payload.methodWorkMin * 60,
          paused: false,
        }).catch(() => {});
      }
      if (buddyPhotoResult) {
        uploadCheckInPhoto(sessionRef.id, selectedCafe.name, buddyPhotoResult).catch(() => {});
      }
      if (adventure) {
        showAlert(adventure.title, adventure.message);
      }
      setBuddyPhotoResult(null);
      setCapturedPhotoUri(null);
      setSelectedCafe(null);
      setSelectedSubject('');
      setSearch('');
      setVisibility('public');
      setIntensity('working');
      setStudyMode('solo');
      setStudyMethod('custom');
      setTimeboxMinutes('45');
      setCustomTotalMinutes('120');
      setCustomWorkMinutes('25');
      setCustomBreakMinutes('5');
      setCustomBreakCount('3');
      setTaggedFriends([]);
      setFriendTagSearch('');
      setWantSync(false);
    } catch (err: any) {
      showAlert('Could not start session', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const changeSubject = async (rawSubject: string) => {
    const newSubject = rawSubject.trim();
    if (!activeSession || !newSubject || newSubject === activeSession.subject) return;
    const now = Date.now();
    const log = getSessionSubjectSegments(activeSession);
    const closedLog = log.map((seg, i) => (i === log.length - 1 ? { ...seg, endedAt: now } : seg));
    const nextLog = [...closedLog, { subject: newSubject, startedAt: now, endedAt: null }];
    try {
      await updateDoc(doc(db, 'studySessions', activeSession.id), {
        subject: newSubject,
        subjectLog: nextLog,
      });
    } catch (err: any) {
      showAlert('Could not change subject', err.message);
    }
  };

  const pauseSession = async () => {
    if (!activeSession || activeSession.pausedAt) return;
    try {
      await updateDoc(doc(db, 'studySessions', activeSession.id), {
        paused: true,
        pausedAt: Date.now(),
      });
      if (profile?.screenTimeShieldEnabled) {
        removeShield().catch(() => {});
      }
      if (activeSession.studyMethod && activeSession.studyMethod !== 'none') {
        updateStudyTimerActivity({
          subject: activeSession.subject,
          phaseLabel: getPhaseLabel(activeSession.methodPhase ?? 'work'),
          phaseEndDate: Date.now(),
          remainingSeconds: Math.round(getPhaseRemainingMs(activeSession, Date.now()) / 1000),
          paused: true,
        }).catch(() => {});
      }
    } catch (err: any) {
      showAlert('Could not pause session', err.message);
    }
  };

  const resumeSession = async () => {
    if (!activeSession || !activeSession.pausedAt) return;
    try {
      const additionalPauseMs = Date.now() - activeSession.pausedAt;
      await updateDoc(doc(db, 'studySessions', activeSession.id), {
        paused: false,
        pausedAt: null,
        pausedMs: (activeSession.pausedMs ?? 0) + additionalPauseMs,
      });
      const phase = activeSession.methodPhase ?? 'work';
      if (profile?.screenTimeShieldEnabled && phase === 'work') {
        applyShield().catch(() => {});
      }
      if (activeSession.studyMethod && activeSession.studyMethod !== 'none') {
        const remainingMs = getPhaseRemainingMs(activeSession, Date.now());
        updateStudyTimerActivity({
          subject: activeSession.subject,
          phaseLabel: getPhaseLabel(phase),
          phaseEndDate: Date.now() + remainingMs,
          remainingSeconds: Math.round(remainingMs / 1000),
          paused: false,
        }).catch(() => {});
      }
    } catch (err: any) {
      showAlert('Could not resume session', err.message);
    }
  };

  const reportBusyness = async (level: BusynessLevel) => {
    if (!activeSession) return;
    try {
      await updateDoc(doc(db, 'studySessions', activeSession.id), { busynessReport: level });
    } catch (err: any) {
      showAlert('Could not report busyness', err.message);
    }
  };

  /** Closes out a session (coins, streak, all-nighter) without touching UI
   * submitting-state — shared by both endSession and startAnotherSession so
   * neither stomps on the other's loading indicator. */
  const closeOutSession = async (session: StudySession): Promise<boolean> => {
    if (!user) return false;
    const endedAt = Date.now();
    const totalPausedMs =
      (session.pausedMs ?? 0) + (session.pausedAt ? endedAt - session.pausedAt : 0);
    const activeMs = Math.max(0, endedAt - session.startedAt - totalPausedMs);
    const {
      coins: coinsEarned,
      newWeeklyStreak,
      newLastStudyWeekKey,
    } = computeStreakCoins(activeMs, endedAt, profile?.weeklyStreak ?? 0, profile?.lastStudyWeekKey);
    const earnedAllNighter = !session.allNighter && isAllNighter(session.startedAt, endedAt);
    const log = getSessionSubjectSegments(session);
    const closedLog = log.map((seg, i) => (i === log.length - 1 ? { ...seg, endedAt } : seg));
    await updateDoc(doc(db, 'studySessions', session.id), {
      endedAt,
      amountSpent: spentMoney === 'yes' ? Number(amountSpent) || 0 : 0,
      subjectLog: closedLog,
      paused: false,
      pausedAt: null,
      pausedMs: totalPausedMs,
      ...(earnedAllNighter ? { allNighter: true } : {}),
    });
    if (coinsEarned > 0 || earnedAllNighter) {
      await updateDoc(doc(db, 'users', user.uid), {
        ...(coinsEarned > 0 ? { petCoins: increment(coinsEarned) } : {}),
        ...(earnedAllNighter ? { allNighterCount: increment(1) } : {}),
        weeklyStreak: newWeeklyStreak,
        lastStudyWeekKey: newLastStudyWeekKey,
      });
    }
    if (profile?.calendarLogging) {
      logStudySessionToCalendar(
        `Studied ${session.subject} at ${session.cafeName}`,
        new Date(session.startedAt),
        new Date(endedAt),
        'Logged via Study Cafe'
      ).catch(() => {});
    }
    if (profile?.screenTimeShieldEnabled) {
      removeShield().catch(() => {});
    }
    if (session.studyMethod && session.studyMethod !== 'none') {
      endStudyTimerActivity().catch(() => {});
    }
    return earnedAllNighter;
  };

  /** Marks me ready to wrap up a synced session. Once my partner also marks
   * ready, the mutual-completion effect fires for both of us at once. */
  const markReadyToUnlock = async () => {
    if (!activeSession) return;
    try {
      await updateDoc(doc(db, 'studySessions', activeSession.id), { syncReadyToUnlock: true });
    } catch (err: any) {
      showAlert('Could not update session', err.message);
    }
  };

  /** Fires once both partners are ready — same instant on both screens. */
  const finalizeMutualCompletion = async () => {
    if (!activeSession || !user || !partnerSession) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Haptics unsupported on this device/platform — not critical.
    }
    setSubmitting(true);
    try {
      const earnedAllNighter = await closeOutSession(activeSession);
      setSpentMoney(null);
      setAmountSpent('');
      // Each device only ever increments its own profile doc — safe to do
      // unconditionally on both sides, unlike the shared pairStats doc below
      // which needs the tie-breaker to avoid double-counting.
      await updateDoc(doc(db, 'users', user.uid), { syncedSessionCount: increment(1) });
      if (user.uid < partnerSession.uid) {
        await incrementPairStats(user.uid, partnerSession.uid);
      }
      if (earnedAllNighter) {
        showAlert('🌙 All-nighter!', "You studied through the night — that's dedication.");
      }
    } catch (err: any) {
      showAlert('Could not complete synced session', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  /** Leaving a synced session early requires a one-line reason, visible only
   * to your partner — soft-tracked at 3/month, never blocked. */
  const submitEarlyExit = async () => {
    if (!activeSession || !user) return;
    const reason = exitReasonDraft.trim().slice(0, 80) || 'No reason given';
    setShowExitReason(false);
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'studySessions', activeSession.id), { syncExitReason: reason });
      const earnedAllNighter = await closeOutSession({ ...activeSession, syncExitReason: reason });
      setSpentMoney(null);
      setAmountSpent('');
      const currentMonthKey = monthKey(Date.now());
      const nextCount =
        profile?.syncExitMonthKey === currentMonthKey ? (profile?.syncExitCount ?? 0) + 1 : 1;
      await updateDoc(doc(db, 'users', user.uid), {
        syncExitCount: nextCount,
        syncExitMonthKey: currentMonthKey,
      });
      if (earnedAllNighter) {
        showAlert('🌙 All-nighter!', "You studied through the night — that's dedication.");
      }
    } catch (err: any) {
      showAlert('Could not leave session', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const endSession = async () => {
    if (!activeSession || !user) return;
    setSubmitting(true);
    try {
      const earnedAllNighter = await closeOutSession(activeSession);
      setSpentMoney(null);
      setAmountSpent('');
      if (earnedAllNighter) {
        showAlert('🌙 All-nighter!', "You studied through the night — that's dedication.");
      }
    } catch (err: any) {
      showAlert('Could not end session', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  /** Ends the current (timed-out) session and immediately starts a fresh one
   * with the same cafe/subject/method settings, for back-to-back blocks. */
  const startAnotherSession = async () => {
    if (!activeSession || !user) return;
    setSubmitting(true);
    try {
      const earnedAllNighter = await closeOutSession(activeSession);
      setSpentMoney(null);
      setAmountSpent('');

      const startedAt = Date.now();
      const payload: Record<string, any> = {
        uid: user.uid,
        displayName: user.displayName ?? 'Someone',
        cafeId: activeSession.cafeId,
        cafeName: activeSession.cafeName,
        cafeLat: activeSession.cafeLat,
        cafeLng: activeSession.cafeLng,
        subject: activeSession.subject,
        startedAt,
        endedAt: null,
        visibility: activeSession.visibility,
        intensity: activeSession.intensity,
        studyMode: activeSession.studyMode,
        subjectLog: [{ subject: activeSession.subject, startedAt, endedAt: null }],
      };
      if (activeSession.community) {
        payload.community = activeSession.community;
      }
      if (activeSession.studyMode === 'group' && activeSession.withFriends?.length) {
        payload.withFriends = activeSession.withFriends;
      }
      if (activeSession.studyMethod && activeSession.studyMethod !== 'none') {
        payload.studyMethod = activeSession.studyMethod;
        payload.methodWorkMin = activeSession.methodWorkMin;
        payload.methodBreakMin = activeSession.methodBreakMin;
        if (activeSession.methodTotalMin != null) payload.methodTotalMin = activeSession.methodTotalMin;
        if (activeSession.methodBreakCount != null) payload.methodBreakCount = activeSession.methodBreakCount;
        payload.methodPhase = 'work';
        payload.methodPhaseStartedAt = startedAt;
        payload.methodRound = 1;
      }
      await addDoc(collection(db, 'studySessions'), payload);
      if (payload.studyMethod) {
        startStudyTimerActivity(activeSession.cafeName, {
          subject: activeSession.subject,
          phaseLabel: getPhaseLabel('work'),
          phaseEndDate: startedAt + payload.methodWorkMin * 60000,
          remainingSeconds: payload.methodWorkMin * 60,
          paused: false,
        }).catch(() => {});
      }
      if (earnedAllNighter) {
        showAlert('🌙 All-nighter!', "You studied through the night — that's dedication.");
      }
    } catch (err: any) {
      showAlert('Could not start another session', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (activeSession) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
        >
        <Text style={styles.heading}>{activeSession.pausedAt ? '⏸ Paused' : "You're studying"}</Text>
        <View style={styles.activeCard}>
          <Text style={styles.activeCafe}>{activeSession.cafeName}</Text>
          <Text style={styles.activeSubject}>{activeSession.subject}</Text>
          <CoffeeMugTimer
            startedAt={activeSession.startedAt}
            pausedMs={activeSession.pausedMs}
            pausedAt={activeSession.pausedAt}
          />
          <Pressable
            style={activeSession.pausedAt ? styles.resumeButton : styles.pauseButton}
            onPress={activeSession.pausedAt ? resumeSession : pauseSession}
          >
            <Text style={activeSession.pausedAt ? styles.resumeButtonText : styles.pauseButtonText}>
              {activeSession.pausedAt ? '▶️ Resume' : '⏸ Pause'}
            </Text>
          </Pressable>
          <View style={styles.activeIntensityPill}>
            <Text style={styles.activeIntensityText}>
              {intensityMeta(activeSession.intensity).emoji} {intensityMeta(activeSession.intensity).label}
            </Text>
          </View>
          {activeSession.studyMode === 'group' && !!activeSession.withFriends?.length && (
            <View style={styles.activeWithFriendsRow}>
              <View style={styles.withFriendsBeans}>
                {activeSession.withFriends.map((f) => (
                  <PixelBean key={f.uid} color={COLORS.accent} size={13} />
                ))}
              </View>
              <Text style={styles.activeWithFriends}>
                With {activeSession.withFriends.map((f) => f.displayName).join(', ')}
              </Text>
            </View>
          )}
          <Text style={styles.activeVisibility}>
            {visibilityMeta(activeSession.visibility).emoji} {visibilityMeta(activeSession.visibility).label}
          </Text>
          <StudyMethodTimer
            session={activeSession}
            screenTimeShieldEnabled={profile?.screenTimeShieldEnabled}
          />
        </View>

        {!!activeSession.syncPartnerUid && (
          <View style={styles.syncStatusCard}>
            {isSynced ? (
              <>
                <Text style={styles.syncStatusTitle}>
                  🔗 Synced with {partnerSession?.displayName}
                </Text>
                <Text style={styles.syncStatusMeta}>
                  📍 {partnerSession?.cafeName} · {partnerSession?.subject}
                  {partnerSession?.pausedAt ? ' · ⏸ paused' : ''}
                </Text>
                {activeSession.syncReadyToUnlock && !partnerSession?.syncReadyToUnlock && (
                  <Text style={styles.syncWaitingText}>
                    Waiting for {partnerSession?.displayName} to finish too…
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.syncStatusTitle}>🔗 Waiting to sync…</Text>
            )}
          </View>
        )}

        {partnerLeftBanner && (
          <View style={styles.syncLeftBanner}>
            <Text style={styles.syncLeftBannerText}>
              🚪 {partnerLeftBanner.name} left the session
              {partnerLeftBanner.reason ? ` — "${partnerLeftBanner.reason}"` : ''}
            </Text>
          </View>
        )}

        {activeSession.cafeId !== HOME_LOCATION.id && (
          <>
            <Text style={styles.label}>How busy is it here?</Text>
            <View style={styles.chipRow}>
              {BUSYNESS_LEVELS.map((b) => (
                <Pressable
                  key={b.value}
                  style={[styles.chip, activeSession.busynessReport === b.value && styles.chipSelected]}
                  onPress={() => reportBusyness(b.value)}
                >
                  <PixelBean color={b.color} size={16} />
                  <Text
                    style={[
                      styles.chipText,
                      activeSession.busynessReport === b.value && styles.chipTextSelected,
                    ]}
                  >
                    {b.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {friendsAtCafe.length > 0 && (
          <View style={styles.lockCard}>
            <Text style={styles.lockCardTitle}>👥 Friends here right now</Text>
            {friendsAtCafe.map((s) => {
              const report = busynessMeta(s.busynessReport);
              return (
                <View key={s.id} style={styles.friendReportRow}>
                  {report && <PixelBean color={report.color} size={13} />}
                  <Text style={styles.friendReportText}>
                    {s.displayName}: {report ? report.label : "hasn't reported yet"}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <Text style={styles.label}>Switch subjects</Text>
        <View style={styles.subjectSwitchRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Subject, course, or major"
            placeholderTextColor={COLORS.textFaint}
            value={subjectDraft}
            onChangeText={setSubjectDraft}
            onSubmitEditing={() => changeSubject(subjectDraft)}
          />
          <Pressable
            style={styles.subjectSwitchButton}
            onPress={() => changeSubject(subjectDraft)}
            disabled={!subjectDraft.trim() || subjectDraft.trim() === activeSession.subject}
          >
            <Text style={styles.subjectSwitchButtonText}>Change</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Did you spend any money this study session?</Text>
        <View style={styles.chipRow}>
          <Pressable
            style={[styles.chip, spentMoney === 'no' && styles.chipSelected]}
            onPress={() => {
              setSpentMoney('no');
              setAmountSpent('');
            }}
          >
            <Text style={[styles.chipText, spentMoney === 'no' && styles.chipTextSelected]}>
              No
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chip, spentMoney === 'yes' && styles.chipSelected]}
            onPress={() => setSpentMoney('yes')}
          >
            <Text style={[styles.chipText, spentMoney === 'yes' && styles.chipTextSelected]}>
              Yes
            </Text>
          </Pressable>
        </View>

        {spentMoney === 'yes' && (
          <>
            <Text style={styles.label}>How much did you spend?</Text>
            <TextInput
              style={styles.input}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={amountSpent}
              onChangeText={setAmountSpent}
              autoFocus
            />
          </>
        )}

        {isSynced ? (
          showExitReason ? (
            <View style={styles.exitReasonCard}>
              <Text style={styles.label}>
                One line for {partnerSession?.displayName} — why are you leaving?
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. ran out of time"
                placeholderTextColor={COLORS.textFaint}
                value={exitReasonDraft}
                onChangeText={setExitReasonDraft}
                maxLength={80}
                autoFocus
              />
              <View style={styles.exitReasonButtonRow}>
                <Pressable style={styles.button} onPress={submitEarlyExit} disabled={submitting}>
                  <Text style={styles.buttonText}>{submitting ? 'Leaving…' : 'Confirm exit'}</Text>
                </Pressable>
                <Pressable style={styles.cancelExitButton} onPress={() => setShowExitReason(false)}>
                  <Text style={styles.cancelExitButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : activeSession.syncReadyToUnlock ? (
            <View style={styles.waitingIndicator}>
              <Text style={styles.buttonText}>
                ✅ Waiting for {partnerSession?.displayName}…
              </Text>
            </View>
          ) : (
            <>
              <Pressable style={styles.button} onPress={markReadyToUnlock} disabled={submitting}>
                <Text style={styles.buttonText}>✅ I'm done studying</Text>
              </Pressable>
              <Pressable
                style={styles.dangerButton}
                onPress={() => setShowExitReason(true)}
                disabled={submitting}
              >
                <Text style={styles.buttonText}>
                  🚪 Leave early{remainingSyncExits > 0 ? ` (${remainingSyncExits} left this month)` : ''}
                </Text>
              </Pressable>
            </>
          )
        ) : activeSession.methodPhase === 'done' ? (
          <>
            <Pressable style={styles.button} onPress={startAnotherSession} disabled={submitting}>
              <Text style={styles.buttonText}>
                {submitting ? 'Starting…' : '🔁 Start another session'}
              </Text>
            </Pressable>
            <Pressable style={styles.dangerButton} onPress={endSession} disabled={submitting}>
              <Text style={styles.buttonText}>{submitting ? 'Ending…' : '🚪 Exit cafe study'}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.dangerButton} onPress={endSession} disabled={submitting}>
            <Text style={styles.buttonText}>{submitting ? 'Ending…' : 'End session'}</Text>
          </Pressable>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
      <Text style={styles.heading}>Start a study session</Text>

      <Text style={styles.label}>Where are you studying?</Text>
      {selectedCafe ? (
        <Pressable style={styles.selectedPill} onPress={() => setSelectedCafe(null)}>
          <Text style={styles.selectedPillText}>{selectedCafe.name} ✕</Text>
        </Pressable>
      ) : (
        <>
          <Pressable
            style={styles.homeLocationButton}
            onPress={() => setSelectedCafe(HOME_LOCATION)}
          >
            <Text style={styles.homeLocationButtonText}>
              Studying at my Bedroom/Dorm instead
            </Text>
          </Pressable>
          <SearchBar
            style={{ marginBottom: 8 }}
            placeholder="Or search cafes (e.g. Duluth, Alchemist)"
            value={search}
            onChangeText={setSearch}
          />
          {showingRecommended && (
            <Text style={styles.recommendedLabel}>📍 Recommended near you</Text>
          )}
          <FlatList
            style={styles.cafeList}
            data={filteredCafes}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Pressable
                style={styles.cafeRow}
                onPress={() =>
                  navigation.navigate('CafeProfile', {
                    cafeId: item.id,
                    cafeName: item.name,
                    confirmCafe: item,
                  })
                }
              >
                <Text style={styles.cafeName}>{item.name}</Text>
                <Text style={styles.cafeNeighborhood}>
                  {item.neighborhood}
                  {item.distance != null ? ` · ${item.distance.toFixed(1)} mi` : ''}
                </Text>
              </Pressable>
            )}
          />
        </>
      )}

      <Text style={styles.label}>Subject</Text>
      <TextInput
        style={styles.input}
        placeholder="Subject, course, or major (e.g. Orgo Chem, CS 2110)"
        placeholderTextColor={COLORS.textFaint}
        value={selectedSubject}
        onChangeText={setSelectedSubject}
      />

      <Text style={styles.label}>Study method</Text>
      <View style={styles.chipRow}>
        {STUDY_METHODS.map((m) => (
          <Pressable
            key={m.value}
            style={[styles.chip, styles.methodChip, studyMethod === m.value && styles.chipSelected]}
            onPress={() => setStudyMethod(m.value)}
          >
            {m.icon ? (
              <Image source={m.icon} style={styles.methodChipIcon} resizeMode="contain" />
            ) : null}
            <Text style={[styles.chipText, studyMethod === m.value && styles.chipTextSelected]}>
              {m.icon ? m.label : `${m.emoji} ${m.label}`}
            </Text>
          </Pressable>
        ))}
      </View>
      {studyMethod !== 'none' && (
        <Text style={styles.hint}>
          {STUDY_METHODS.find((m) => m.value === studyMethod)?.description}
        </Text>
      )}
      {studyMethod === 'timeboxing' && (
        <TextInput
          style={styles.input}
          placeholder="Minutes (e.g. 45)"
          placeholderTextColor={COLORS.textFaint}
          keyboardType="number-pad"
          value={timeboxMinutes}
          onChangeText={setTimeboxMinutes}
        />
      )}
      {studyMethod === 'custom' && (
        <View style={styles.customMethodGrid}>
          <View style={styles.customMethodField}>
            <Text style={styles.customMethodLabel}>Total session (min)</Text>
            <TextInput
              style={styles.input}
              placeholder="120"
              placeholderTextColor={COLORS.textFaint}
              keyboardType="number-pad"
              value={customTotalMinutes}
              onChangeText={setCustomTotalMinutes}
            />
          </View>
          <View style={styles.customMethodField}>
            <Text style={styles.customMethodLabel}>Work interval (min)</Text>
            <TextInput
              style={styles.input}
              placeholder="25"
              placeholderTextColor={COLORS.textFaint}
              keyboardType="number-pad"
              value={customWorkMinutes}
              onChangeText={setCustomWorkMinutes}
            />
          </View>
          <View style={styles.customMethodField}>
            <Text style={styles.customMethodLabel}>Break length (min)</Text>
            <TextInput
              style={styles.input}
              placeholder="5"
              placeholderTextColor={COLORS.textFaint}
              keyboardType="number-pad"
              value={customBreakMinutes}
              onChangeText={setCustomBreakMinutes}
            />
          </View>
          <View style={styles.customMethodField}>
            <Text style={styles.customMethodLabel}>Number of breaks</Text>
            <TextInput
              style={styles.input}
              placeholder="3"
              placeholderTextColor={COLORS.textFaint}
              keyboardType="number-pad"
              value={customBreakCount}
              onChangeText={setCustomBreakCount}
            />
          </View>
        </View>
      )}

      <Text style={styles.label}>How locked in are you?</Text>
      <View style={styles.chipRow}>
        {STUDY_INTENSITIES.map((i) => (
          <Pressable
            key={i.value}
            style={[styles.chip, intensity === i.value && styles.chipSelected]}
            onPress={() => setIntensity(i.value)}
          >
            <Text style={[styles.chipText, intensity === i.value && styles.chipTextSelected]}>
              {i.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Studying</Text>
      <View style={styles.chipRow}>
        <Pressable
          style={[styles.chip, styles.methodChip, studyMode === 'solo' && styles.chipSelected]}
          onPress={() => setStudyMode('solo')}
        >
          <Image source={UI_ICONS.byMyself} style={styles.methodChipIcon} resizeMode="contain" />
          <Text style={[styles.chipText, studyMode === 'solo' && styles.chipTextSelected]}>
            By myself
          </Text>
        </Pressable>
        <Pressable
          style={[styles.chip, styles.methodChip, studyMode === 'group' && styles.chipSelected]}
          onPress={() => setStudyMode('group')}
        >
          <Image source={UI_ICONS.withFriends} style={styles.methodChipIcon} resizeMode="contain" />
          <Text style={[styles.chipText, studyMode === 'group' && styles.chipTextSelected]}>
            With friends
          </Text>
        </Pressable>
      </View>

      {studyMode === 'group' && (
        <>
          <Text style={styles.label}>Tag who you're studying with</Text>
          {friends.length === 0 ? (
            <Text style={styles.emptyText}>Add friends to tag them here.</Text>
          ) : (
            <>
              {taggedFriends.length > 0 && (
                <View style={styles.chipRow}>
                  {taggedFriends.map((f) => (
                    <Pressable
                      key={f.uid}
                      style={[styles.chip, styles.chipSelected]}
                      onPress={() => toggleTaggedFriend(f)}
                    >
                      <Text style={[styles.chipText, styles.chipTextSelected]}>
                        {f.displayName} ✕
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <SearchBar
                style={{ marginBottom: 8 }}
                placeholder="Search friends by username"
                value={friendTagSearch}
                onChangeText={setFriendTagSearch}
              />
              <View style={styles.chipRow}>
                {filteredFriendsForTag
                  .filter((f) => !taggedFriends.some((t) => t.uid === f.uid))
                  .map((f) => (
                    <Pressable key={f.uid} style={styles.chip} onPress={() => toggleTaggedFriend(f)}>
                      <Text style={styles.chipText}>
                        {f.displayName}
                        {f.username ? ` · @${f.username}` : ''}
                      </Text>
                    </Pressable>
                  ))}
              </View>
            </>
          )}
          {taggedFriends.length === 1 && (
            <>
              <Pressable style={styles.syncToggle} onPress={() => setWantSync((v) => !v)}>
                <Text style={styles.syncToggleText}>
                  {wantSync ? '☑' : '☐'} 🔗 Sync & lock this session with {taggedFriends[0].displayName}
                </Text>
              </Pressable>
              {wantSync && (
                <Text style={styles.hint}>
                  {taggedFriends[0].displayName} needs to start their own session, tag you, and turn
                  this on too — once you both do, you're synced. Leaving early needs a one-line reason
                  they'll see.
                </Text>
              )}
            </>
          )}
        </>
      )}

      <Text style={styles.label}>Check-in photo (optional)</Text>
      {buddyPhotoResult ? (
        <View style={styles.photoPreviewWrap}>
          <Image
            source={{ uri: buddyPhotoResult.compositedUri ?? buddyPhotoResult.originalUri }}
            style={styles.photoPreview}
          />
          <View style={styles.photoPreviewActions}>
            <Pressable style={styles.secondaryChip} onPress={takeCheckInPhoto}>
              <Text style={styles.secondaryChipText}>Retake</Text>
            </Pressable>
            <Pressable style={styles.secondaryChip} onPress={removeCheckInPhoto}>
              <Text style={styles.secondaryChipText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={[styles.photoPickButton, styles.photoPickButtonRow]} onPress={takeCheckInPhoto}>
          <Image source={UI_ICONS.camera} style={styles.photoPickButtonIcon} resizeMode="contain" />
          <Text style={styles.photoPickButtonText}>Take a photo with your buddy</Text>
        </Pressable>
      )}

      <Text style={styles.label}>Who can see this session?</Text>
      <View style={styles.chipRow}>
        {VISIBILITY_LEVELS.filter((v) => v.value !== 'community' || !!profile?.community).map((v) => (
          <Pressable
            key={v.value}
            style={[styles.chip, visibility === v.value && styles.chipSelected]}
            onPress={() => setVisibility(v.value)}
          >
            <Text style={[styles.chipText, visibility === v.value && styles.chipTextSelected]}>
              {v.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        style={[styles.button, (!selectedCafe || !selectedSubject) && styles.buttonDisabled]}
        onPress={startSession}
        disabled={!selectedCafe || !selectedSubject || submitting}
      >
        <Text style={styles.buttonText}>
          {submitting ? 'Starting…' : 'Start studying'}
        </Text>
      </Pressable>
      </ScrollView>
      {capturedPhotoUri && (
        <BuddyPhotoEditor
          visible={editorVisible}
          photoUri={capturedPhotoUri}
          friend={activeCoffeeFriend}
          initialPoseId={editorPoseId}
          onCancel={() => {
            setEditorVisible(false);
            setCapturedPhotoUri(null);
          }}
          onSave={(result) => {
            setBuddyPhotoResult(result);
            setEditorVisible(false);
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16, fontFamily: FONTS.bold, letterSpacing: 1.0 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 8,
    marginBottom: 6,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.4,
  },
  recommendedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.accent,
    marginBottom: 6,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.3,
  },
  hint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 12,
    lineHeight: 17,
    fontFamily: FONTS.regular,
    letterSpacing: 0.3,
  },
  syncToggle: { marginBottom: 8 },
  syncToggleText: { fontSize: 13, fontWeight: '600', color: COLORS.text, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginBottom: 8,
  },
  customMethodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  customMethodField: { width: '47%' },
  customMethodLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 4,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.2,
  },
  cafeList: { marginBottom: 8 },
  cafeRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  cafeName: { fontSize: 15, fontWeight: '500', fontFamily: FONTS.medium, letterSpacing: 0.4 },
  cafeNeighborhood: { fontSize: 12, color: COLORS.textMuted, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  selectedPill: {
    backgroundColor: COLORS.accentLight,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  selectedPillText: { fontWeight: '600', fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  subjectSwitchRow: { flexDirection: 'row', gap: 8, marginBottom: 16, alignItems: 'center' },
  subjectSwitchButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  subjectSwitchButtonText: { color: '#fff', fontWeight: '600', fontSize: 13, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.text, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  chipTextSelected: { color: '#fff' },
  methodChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  methodChipIcon: { width: 20, height: 20 },
  emptyText: { color: COLORS.textFaint, marginBottom: 12, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { backgroundColor: COLORS.textFaint },
  dangerButton: {
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16, fontFamily: FONTS.semiBold, letterSpacing: 0.6 },
  activeCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  activeCafe: { fontSize: 18, fontWeight: '700', alignSelf: 'flex-start', fontFamily: FONTS.semiBold, letterSpacing: 0.7 },
  activeSubject: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 4,
    alignSelf: 'flex-start',
    fontFamily: FONTS.regular,
    letterSpacing: 0.4,
  },
  friendReportRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  friendReportText: { fontSize: 13, color: COLORS.textMuted, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  pauseButton: {
    backgroundColor: COLORS.accentLight,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  resumeButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  pauseButtonText: { fontSize: 13, fontWeight: '700', color: COLORS.primary, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  resumeButtonText: { fontSize: 13, fontWeight: '700', color: COLORS.white, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  homeLocationButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  homeLocationButtonText: { fontSize: 13, fontWeight: '600', color: COLORS.text, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  photoPickButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: COLORS.card,
    marginBottom: 12,
  },
  photoPickButtonRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  photoPickButtonIcon: { width: 18, height: 18 },
  photoPickButtonText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  photoPreviewWrap: { marginBottom: 12 },
  photoPreview: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#000' },
  photoPreviewActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  secondaryChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  secondaryChipText: { fontSize: 12, fontWeight: '600', color: COLORS.text, fontFamily: FONTS.semiBold, letterSpacing: 0.3 },
  activeIntensityPill: {
    backgroundColor: COLORS.accentLight,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  activeIntensityText: { fontSize: 13, fontWeight: '600', color: COLORS.primary, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  activeWithFriendsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  withFriendsBeans: { flexDirection: 'row', gap: 2 },
  activeWithFriends: { fontSize: 12, color: COLORS.textMuted, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  activeVisibility: {
    fontSize: 12,
    color: COLORS.textFaint,
    marginTop: 8,
    alignSelf: 'flex-start',
    fontFamily: FONTS.regular,
    letterSpacing: 0.3,
  },
  lockCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  lockCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.6,
  },
  syncStatusCard: {
    backgroundColor: COLORS.accentLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  syncStatusTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primary, fontFamily: FONTS.semiBold, letterSpacing: 0.6 },
  syncStatusMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 4, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  syncWaitingText: {
    fontSize: 12,
    color: COLORS.accent,
    fontWeight: '600',
    marginTop: 6,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.3,
  },
  syncLeftBanner: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  syncLeftBannerText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    fontFamily: FONTS.regular,
    letterSpacing: 0.3,
  },
  exitReasonCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  exitReasonButtonRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  cancelExitButton: { paddingVertical: 14, paddingHorizontal: 8 },
  cancelExitButtonText: {
    color: COLORS.textMuted,
    fontWeight: '600',
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.4,
  },
  waitingIndicator: {
    backgroundColor: COLORS.textFaint,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
});
