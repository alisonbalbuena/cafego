import { addDoc, collection, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { BuddyPostSource } from '../types';

interface PostBuddyAdventureInput {
  displayName: string;
  buddyName: string;
  poseId?: string;
  cafeName?: string;
  location?: string;
  caption?: string;
  source: BuddyPostSource;
  /** Local file uri to upload — omit if `imageUrl` is already hosted. */
  photoUri?: string;
  /** Already-uploaded url (e.g. a check-in photo already sent to Storage for
   * the session) — skips a redundant re-upload. */
  imageUrl?: string;
}

/** Shares a Coffee Buddy photo to the buddy adventure feed (Home + the
 * poster's own profile) — used by both the PetScreen "take an adventure"
 * button and the check-in photo flow. */
export async function postBuddyAdventure(uid: string, input: PostBuddyAdventureInput): Promise<void> {
  let imageUrl = input.imageUrl;
  if (!imageUrl && input.photoUri) {
    const fileRef = ref(storage, `buddyPosts/${uid}/${Date.now()}.jpg`);
    const blob = await (await fetch(input.photoUri)).blob();
    await uploadBytes(fileRef, blob);
    imageUrl = await getDownloadURL(fileRef);
  }
  if (!imageUrl) return;
  await addDoc(collection(db, 'buddyPosts'), {
    uid,
    displayName: input.displayName,
    buddyName: input.buddyName,
    imageUrl,
    ...(input.poseId ? { poseId: input.poseId } : {}),
    ...(input.cafeName ? { cafeName: input.cafeName } : {}),
    ...(input.location ? { location: input.location } : {}),
    ...(input.caption ? { caption: input.caption } : {}),
    source: input.source,
    createdAt: Date.now(),
  });
}

export async function deleteBuddyPost(postId: string): Promise<void> {
  await deleteDoc(doc(db, 'buddyPosts', postId));
}

export async function postBuddyPostComment(
  postId: string,
  uid: string,
  displayName: string,
  text: string
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await addDoc(collection(db, 'buddyPostComments'), {
    postId,
    uid,
    displayName,
    text: trimmed,
    createdAt: Date.now(),
  });
}

export async function deleteBuddyPostComment(commentId: string): Promise<void> {
  await deleteDoc(doc(db, 'buddyPostComments', commentId));
}
