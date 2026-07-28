import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { BuddyPost } from '../types';
import { formatRelativeTime } from '../utils/format';
import { showConfirm } from '../utils/alert';
import { deleteBuddyPost, deleteBuddyPostComment, postBuddyPostComment } from '../utils/buddyPosts';
import { useBuddyPostComments } from '../hooks/useBuddyPostComments';
import { COLORS, FONTS, RADIUS } from '../theme';

interface Props {
  post: BuddyPost | null;
  visible: boolean;
  onClose: () => void;
  currentUid?: string;
  currentDisplayName?: string;
  /** Only true on the poster's own profile — the only place a post can be discarded from. */
  canDelete?: boolean;
  onDeleted?: () => void;
}

export default function BuddyPostDetailModal({
  post,
  visible,
  onClose,
  currentUid,
  currentDisplayName,
  canDelete,
  onDeleted,
}: Props) {
  const comments = useBuddyPostComments(post?.id ?? null);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);

  if (!post) return null;

  const place = post.location ?? post.cafeName;

  const handleDeletePost = async () => {
    const confirmed = await showConfirm(
      'Delete this post?',
      'This adventure photo will be removed from the feed and your profile.',
      'Delete'
    );
    if (!confirmed) return;
    await deleteBuddyPost(post.id).catch(() => {});
    onDeleted?.();
    onClose();
  };

  const handleDeleteComment = async (commentId: string) => {
    const confirmed = await showConfirm('Delete this comment?', 'This cannot be undone.', 'Delete');
    if (!confirmed) return;
    deleteBuddyPostComment(commentId).catch(() => {});
  };

  const handleSendComment = async () => {
    if (!currentUid || !commentText.trim()) return;
    setSending(true);
    try {
      await postBuddyPostComment(post.id, currentUid, currentDisplayName ?? 'Someone', commentText);
      setCommentText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          style={styles.sheetWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {post.buddyName}
              </Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              <Image source={{ uri: post.imageUrl }} style={styles.photo} resizeMode="cover" />

              <View style={styles.metaRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.authorText}>{post.displayName}</Text>
                  <Text style={styles.metaText}>
                    {place ? `📍 ${place} · ` : ''}
                    {formatRelativeTime(post.createdAt)}
                  </Text>
                </View>
                {canDelete && (
                  <Pressable onPress={handleDeletePost} hitSlop={8}>
                    <Text style={styles.discardText}>Discard</Text>
                  </Pressable>
                )}
              </View>

              {!!post.caption && <Text style={styles.captionText}>{post.caption}</Text>}

              <View style={styles.commentsHeaderRow}>
                <Text style={styles.commentsHeading}>
                  Comments{comments.length > 0 ? ` (${comments.length})` : ''}
                </Text>
              </View>

              {comments.length === 0 ? (
                <Text style={styles.emptyComments}>No comments yet — be the first!</Text>
              ) : (
                comments.map((c) => (
                  <View key={c.id} style={styles.commentRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.commentAuthor}>{c.displayName}</Text>
                      <Text style={styles.commentText}>{c.text}</Text>
                      <Text style={styles.commentMeta}>{formatRelativeTime(c.createdAt)}</Text>
                    </View>
                    {currentUid === c.uid && (
                      <Pressable onPress={() => handleDeleteComment(c.id)} hitSlop={8}>
                        <Text style={styles.commentDelete}>✕</Text>
                      </Pressable>
                    )}
                  </View>
                ))
              )}
            </ScrollView>

            {currentUid && (
              <View style={styles.commentInputRow}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Add a comment…"
                  placeholderTextColor={COLORS.textFaint}
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                />
                <Pressable
                  style={[styles.sendButton, (!commentText.trim() || sending) && styles.sendButtonDisabled]}
                  onPress={handleSendComment}
                  disabled={!commentText.trim() || sending}
                >
                  <Text style={styles.sendButtonText}>Send</Text>
                </Pressable>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheetWrap: { maxHeight: '88%' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 3,
    borderColor: COLORS.primary,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerTitle: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.text, flex: 1, letterSpacing: 0.5 },
  closeText: { fontSize: 18, color: COLORS.textMuted, fontFamily: FONTS.bold, paddingLeft: 12 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  photo: { width: '100%', height: 260, borderRadius: RADIUS.md, backgroundColor: '#000' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  authorText: { fontSize: 13, fontFamily: FONTS.semiBold, color: COLORS.text, letterSpacing: 0.3 },
  metaText: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textFaint, marginTop: 2 },
  discardText: { fontSize: 12, fontFamily: FONTS.semiBold, color: COLORS.danger, letterSpacing: 0.3 },
  captionText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    marginTop: 10,
    fontStyle: 'italic',
  },
  commentsHeaderRow: { marginTop: 20, marginBottom: 8 },
  commentsHeading: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.text, letterSpacing: 0.4 },
  emptyComments: { fontSize: 12, fontFamily: FONTS.regular, color: COLORS.textFaint },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  commentAuthor: { fontSize: 12, fontFamily: FONTS.semiBold, color: COLORS.text, letterSpacing: 0.2 },
  commentText: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.text, marginTop: 2 },
  commentMeta: { fontSize: 10, fontFamily: FONTS.regular, color: COLORS.textFaint, marginTop: 3 },
  commentDelete: { fontSize: 14, color: COLORS.textFaint, paddingLeft: 10, fontFamily: FONTS.bold },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  commentInput: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 90,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: COLORS.white, fontFamily: FONTS.semiBold, fontSize: 13, letterSpacing: 0.3 },
});
