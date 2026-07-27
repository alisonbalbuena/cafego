import React from 'react';
import { View, Text, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import { BuddyPost } from '../types';
import { formatRelativeTime } from '../utils/format';
import { showConfirm } from '../utils/alert';
import { deleteBuddyPost } from '../utils/buddyPosts';
import { COLORS, RADIUS } from '../theme';

interface Props {
  posts: BuddyPost[];
  showAuthor?: boolean;
  emptyText: string;
  /** Pass the signed-in user's uid to show a delete button on their own posts. */
  currentUid?: string;
}

export default function BuddyAdventureStrip({ posts, showAuthor, emptyText, currentUid }: Props) {
  if (posts.length === 0) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }

  const handleDelete = async (post: BuddyPost) => {
    const confirmed = await showConfirm(
      'Delete this post?',
      "This adventure photo will be removed from the feed and your profile.",
      'Delete'
    );
    if (!confirmed) return;
    deleteBuddyPost(post.id).catch(() => {});
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {posts.map((post) => {
        const place = post.location ?? post.cafeName;
        return (
          <View key={post.id} style={styles.card}>
            <Image source={{ uri: post.imageUrl }} style={styles.photo} resizeMode="cover" />
            {currentUid === post.uid && (
              <Pressable style={styles.deleteButton} onPress={() => handleDelete(post)} hitSlop={8}>
                <Text style={styles.deleteButtonText}>✕</Text>
              </Pressable>
            )}
            <View style={styles.captionWrap}>
              <Text style={styles.buddyName} numberOfLines={1}>
                {post.buddyName}
              </Text>
              {showAuthor && (
                <Text style={styles.author} numberOfLines={1}>
                  {post.displayName}
                </Text>
              )}
              {!!post.caption && (
                <Text style={styles.captionText} numberOfLines={2}>
                  {post.caption}
                </Text>
              )}
              <Text style={styles.meta} numberOfLines={1}>
                {place ? `📍 ${place} · ` : ''}
                {formatRelativeTime(post.createdAt)}
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 12, paddingHorizontal: 2, paddingBottom: 4 },
  card: {
    width: 140,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  photo: { width: '100%', height: 150, backgroundColor: '#000' },
  deleteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  captionWrap: { padding: 8 },
  buddyName: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  author: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  captionText: { fontSize: 11, color: COLORS.text, marginTop: 3, fontStyle: 'italic' },
  meta: { fontSize: 10, color: COLORS.textFaint, marginTop: 3 },
  emptyText: { color: COLORS.textFaint, fontSize: 13 },
});
