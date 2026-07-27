import { Linking, Platform } from 'react-native';
import * as Calendar from 'expo-calendar';

/** Google Calendar's event-template URL — opening it deep-links straight into
 * the Google Calendar app (or web) with the event pre-filled, skipping the
 * device Calendar app entirely. One tap on "Save" and it's on their Google
 * Calendar. This is the only direct-to-Google path that works without a full
 * Google OAuth integration (which Expo Go can't do). */
export function googleCalendarEventUrl(
  title: string,
  startDate: Date,
  endDate: Date,
  details?: string
): string {
  // Google's expected format: UTC timestamps as YYYYMMDDTHHMMSSZ.
  const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(startDate)}/${fmt(endDate)}`,
    ...(details ? { details } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Opens Google Calendar (app or web) with a study invite pre-filled. */
export async function addStudyInviteToCalendar(
  title: string,
  startDate: Date,
  endDate: Date,
  notes?: string
): Promise<void> {
  await Linking.openURL(googleCalendarEventUrl(title, startDate, endDate, notes));
}

/** Asks for calendar access (the one-time "connect your calendar" step for
 * automatic session logging). Returns false on web or if the user denies. */
export async function ensureCalendarPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

async function getWritableCalendarId(): Promise<string | null> {
  if (Platform.OS === 'ios') {
    const cal = await Calendar.getDefaultCalendarAsync();
    return cal?.id ?? null;
  }
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const primary =
    cals.find((c) => c.isPrimary && c.allowsModifications) ??
    cals.find((c) => c.allowsModifications);
  return primary?.id ?? null;
}

/** Silently writes a finished study session into the user's calendar — no UI,
 * unlike the invite flow above, since this runs automatically at the end of
 * every session once the user opts in. The device calendar's own Google sync
 * then carries it to Google Calendar. Returns false if it couldn't write. */
export async function logStudySessionToCalendar(
  title: string,
  startDate: Date,
  endDate: Date,
  notes?: string
): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    if (!(await ensureCalendarPermission())) return false;
    const calendarId = await getWritableCalendarId();
    if (!calendarId) return false;
    await Calendar.createEventAsync(calendarId, { title, startDate, endDate, notes });
    return true;
  } catch {
    return false;
  }
}
