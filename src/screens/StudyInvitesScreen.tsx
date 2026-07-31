import React, { useMemo, useState } from 'react';
import { View, Text, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';
import { useStudyInvites } from '../hooks/useStudyInvites';
import { StudyInvite } from '../types';
import { showAlert } from '../utils/alert';
import { addStudyInviteToCalendar } from '../utils/calendarSync';
import { COLORS, RADIUS, FONTS } from '../theme';
import BackButton from '../components/BackButton';
import { UI_ICONS } from '../data/uiIcons';

export default function StudyInvitesScreen({ navigation }: any) {
  const { user } = useAuth();
  const { received, sent } = useStudyInvites(user?.uid);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pendingReceived = useMemo(
    () => received.filter((i) => i.status === 'pending').sort((a, b) => a.scheduledAt - b.scheduledAt),
    [received]
  );
  const upcoming = useMemo(() => {
    const all = [...received, ...sent].filter(
      (i) => i.status === 'accepted' && i.scheduledAt > Date.now()
    );
    const seen = new Set<string>();
    return all
      .filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
      .sort((a, b) => a.scheduledAt - b.scheduledAt);
  }, [received, sent]);

  const addToGoogleCalendar = (invite: StudyInvite) => {
    const otherName = invite.fromUid === user?.uid ? invite.toName : invite.fromName;
    addStudyInviteToCalendar(
      `Study with ${otherName}${invite.subject ? ` — ${invite.subject}` : ''}`,
      new Date(invite.scheduledAt),
      new Date(invite.scheduledAt + invite.durationMin * 60000),
      'Scheduled via Focus Brew'
    ).catch(() => {});
  };

  const respond = async (invite: StudyInvite, accept: boolean) => {
    setBusyId(invite.id);
    try {
      await updateDoc(doc(db, 'studyInvites', invite.id), {
        status: accept ? 'accepted' : 'declined',
      });
      if (accept) addToGoogleCalendar(invite);
    } catch (err: any) {
      showAlert('Could not update invite', err.message);
    } finally {
      setBusyId(null);
    }
  };

  const formatWhen = (ts: number) =>
    new Date(ts).toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <BackButton navigation={navigation} />
        <Image source={UI_ICONS.studyInvites} style={styles.headingIcon} resizeMode="contain" />
        <Text style={styles.heading}>Study invites</Text>
      </View>

      <Pressable
        style={styles.newButton}
        onPress={() => navigation.navigate('CreateStudyInvite')}
      >
        <Text style={styles.newButtonText}>+ Invite a friend to study</Text>
      </Pressable>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {pendingReceived.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Waiting on your reply</Text>
            {pendingReceived.map((invite) => (
              <View key={invite.id} style={styles.inviteCard}>
                <Text style={styles.inviteTitle}>
                  {invite.fromName} wants to study with you
                </Text>
                <Text style={styles.inviteMeta}>
                  {formatWhen(invite.scheduledAt)} · {invite.durationMin} min
                  {invite.subject ? ` · ${invite.subject}` : ''}
                </Text>
                <View style={styles.inviteButtonRow}>
                  <Pressable
                    style={styles.acceptButton}
                    onPress={() => respond(invite, true)}
                    disabled={busyId === invite.id}
                  >
                    <Text style={styles.acceptButtonText}>Accept</Text>
                  </Pressable>
                  <Pressable
                    style={styles.declineButton}
                    onPress={() => respond(invite, false)}
                    disabled={busyId === invite.id}
                  >
                    <Text style={styles.declineButtonText}>Decline</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Upcoming</Text>
        {upcoming.length === 0 ? (
          <Text style={styles.emptyText}>No confirmed sessions scheduled yet.</Text>
        ) : (
          upcoming.map((invite) => (
            <View key={invite.id} style={styles.inviteCard}>
              <Text style={styles.inviteTitle}>
                ✅ With {invite.fromUid === user?.uid ? invite.toName : invite.fromName}
              </Text>
              <Text style={styles.inviteMeta}>
                {formatWhen(invite.scheduledAt)} · {invite.durationMin} min
                {invite.subject ? ` · ${invite.subject}` : ''}
              </Text>
              <Pressable
                style={styles.calendarButton}
                onPress={() => addToGoogleCalendar(invite)}
              >
                <Text style={styles.calendarButtonText}>Add to Google Calendar</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: COLORS.bg },
  heading: { fontSize: 22, fontWeight: '700', flexShrink: 1, fontFamily: FONTS.bold, letterSpacing: 1.0 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  headingIcon: { width: 26, height: 26 },
  newButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  newButtonText: { color: '#fff', fontWeight: '600', fontSize: 15, fontFamily: FONTS.semiBold, letterSpacing: 0.5 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 8,
    marginTop: 8,
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.6,
  },
  emptyText: { color: COLORS.textFaint, marginBottom: 12, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  inviteCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 10,
  },
  inviteTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, fontFamily: FONTS.semiBold, letterSpacing: 0.6 },
  inviteMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  inviteButtonRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  acceptButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  acceptButtonText: { color: '#fff', fontWeight: '600', fontSize: 13, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  declineButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  declineButtonText: { color: COLORS.textMuted, fontWeight: '600', fontSize: 13, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
  calendarButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  calendarButtonText: { color: COLORS.link, fontWeight: '600', fontSize: 13, fontFamily: FONTS.semiBold, letterSpacing: 0.4 },
});
