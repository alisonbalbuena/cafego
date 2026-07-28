import React, { useState } from 'react';
import { View, Text, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import { BuddyPost } from '../types';
import { formatRelativeTime } from '../utils/format';
import { showConfirm } from '../utils/alert';
import { deleteBuddyPost } from '../utils/buddyPosts';
import BuddyPostDetailModal from './BuddyPostDetailModal';
import { COLORS, FONTS } from '../theme';

interface Props {
  posts: BuddyPost[];
  showAuthor?: boolean;
  emptyText: string;
  /** The signed-in user's uid/name — used for comment authorship. Pass on
   * every screen that renders this (Home included) so commenting works. */
  currentUid?: string;
  currentDisplayName?: string;
  /** Only true on the poster's own profile — the only place a post can be
   * discarded from, per product decision (Home just shows the feed). */
  allowDeletePost?: boolean;
}

export default function BuddyAdventureStrip({
  posts,
  showAuthor,
  emptyText,
  currentUid,
  currentDisplayName,
  allowDeletePost,
}: Props) {
  const [selectedPost, setSelectedPost] = useState<BuddyPost | null>(null);

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
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {posts.map((post) => {
          const place = post.location ?? post.cafeName;
          return (
            <View key={post.id} style={styles.card}>
              <Pressable onPress={() => setSelectedPost(post)}>
                <Image source={{ uri: post.imageUrl }} style={styles.photo} resizeMode="cover" />
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
              </Pressable>
              {allowDeletePost && currentUid === post.uid && (
                <Pressable style={styles.deleteButton} onPress={() => handleDelete(post)} hitSlop={8}>
                  <Text style={styles.deleteButtonText}>✕</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>

      <BuddyPostDetailModal
        post={selectedPost}
        visible={!!selectedPost}
        onClose={() => setSelectedPost(null)}
        currentUid={currentUid}
        currentDisplayName={currentDisplayName}
        canDelete={!!allowDeletePost && !!selectedPost && currentUid === selectedPost.uid}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { gap: 12, paddingHorizontal: 2, paddingBottom: 4 },
  card: {
    width: 140,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderWidth: 3,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOpacity: 1,
    shadowOffset: { width: 2, height: 2 },
    shadowRadius: 0,
    elevation: 3,
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
  deleteButtonText: { color: '#fff', fontSize: 12, fontFamily: FONTS.semiBold },
  captionWrap: { padding: 8 },
  buddyName: { fontSize: 12, fontFamily: FONTS.semiBold, color: COLORS.text, letterSpacing: 0.4 },
  author: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.textMuted, marginTop: 1 },
  captionText: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    marginTop: 3,
    fontStyle: 'italic',
  },
  meta: { fontSize: 10, fontFamily: FONTS.regular, color: COLORS.textFaint, marginTop: 3 },
  emptyText: { color: COLORS.textFaint, fontSize: 13, fontFamily: FONTS.regular },
});
