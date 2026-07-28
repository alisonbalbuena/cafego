import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  PanResponder,
  Pressable,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { CoffeeFriend } from '../data/coffeeFriends';
import { BUDDY_POSES, getBuddyPose } from '../data/buddyPoses';
import CoffeeBuddySprite from './CoffeeBuddySprite';
import { COLORS, RADIUS, FONTS } from '../theme';

export interface BuddyPhotoResult {
  originalUri: string;
  /** Flattened image with the buddy baked in — null if capture failed
   * (e.g. some web browsers), in which case only the original is kept. */
  compositedUri: string | null;
  poseId: string;
}

interface Props {
  visible: boolean;
  photoUri: string;
  friend: CoffeeFriend;
  initialPoseId: string;
  onCancel: () => void;
  onSave: (result: BuddyPhotoResult) => void;
}

const SPRITE_BASE = 110;
const EDGE_MARGIN = 24;
const MIN_SCALE = 0.35;
const MAX_SCALE = 3.5;

export default function BuddyPhotoEditor({
  visible,
  photoUri,
  friend,
  initialPoseId,
  onCancel,
  onSave,
}: Props) {
  const screen = Dimensions.get('window');
  const canvasW = Math.min(screen.width - 32, 520);
  const [aspect, setAspect] = useState(4 / 3);
  const canvasH = Math.min(canvasW / aspect, screen.height * 0.62);

  const [poseId, setPoseId] = useState(initialPoseId);
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [saving, setSaving] = useState(false);

  const canvasRef = useRef<View>(null);
  // Incremental gesture baselines — updated every move so transitions between
  // one and two fingers never cause the sprite to jump.
  const lastSingle = useRef<{ x: number; y: number } | null>(null);
  const lastPinch = useRef<{ dist: number; angle: number } | null>(null);
  const boundsRef = useRef({ w: canvasW, h: canvasH });
  boundsRef.current = { w: canvasW, h: canvasH };

  useEffect(() => {
    if (!visible) return;
    setPoseId(initialPoseId);
    setScale(1);
    setRotation(0);
    // Buddy starts in the bottom-right corner.
    setCenter({
      x: canvasW - SPRITE_BASE / 2 - 12,
      y: canvasH - SPRITE_BASE / 2 - 12,
    });
    Image.getSize(
      photoUri,
      (w, h) => setAspect(w / h),
      () => setAspect(4 / 3)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, photoUri]);

  const clampCenter = (x: number, y: number) => {
    const { w, h } = boundsRef.current;
    return {
      x: Math.min(Math.max(x, EDGE_MARGIN), w - EDGE_MARGIN),
      y: Math.min(Math.max(y, EDGE_MARGIN), h - EDGE_MARGIN),
    };
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (e) => {
          const touches = e.nativeEvent.touches;
          if (touches.length >= 2) {
            lastSingle.current = null;
            const [a, b] = touches;
            const dx = b.pageX - a.pageX;
            const dy = b.pageY - a.pageY;
            const dist = Math.max(10, Math.hypot(dx, dy));
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            if (lastPinch.current) {
              const ratio = dist / lastPinch.current.dist;
              setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * ratio)));
              setRotation((r) => r + (angle - lastPinch.current!.angle));
            }
            lastPinch.current = { dist, angle };
          } else if (touches.length === 1) {
            lastPinch.current = null;
            const t = touches[0];
            if (lastSingle.current) {
              const dx = t.pageX - lastSingle.current.x;
              const dy = t.pageY - lastSingle.current.y;
              setCenter((c) => clampCenter(c.x + dx, c.y + dy));
            }
            lastSingle.current = { x: t.pageX, y: t.pageY };
          }
        },
        onPanResponderRelease: () => {
          lastSingle.current = null;
          lastPinch.current = null;
        },
        onPanResponderTerminate: () => {
          lastSingle.current = null;
          lastPinch.current = null;
        },
      }),
    []
  );

  const shufflePose = () => {
    const others = BUDDY_POSES.filter((p) => p.id !== poseId);
    setPoseId(others[Math.floor(Math.random() * others.length)].id);
  };

  const save = async () => {
    setSaving(true);
    let compositedUri: string | null = null;
    try {
      compositedUri = await captureRef(canvasRef, { format: 'jpg', quality: 0.85 });
    } catch {
      // Capture unsupported (some web browsers) — keep the original only.
    }
    setSaving(false);
    onSave({ originalUri: photoUri, compositedUri, poseId });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Place your buddy</Text>
          <Text style={styles.hint}>
            Drag to move · pinch to resize and rotate — {getBuddyPose(poseId).label.toLowerCase()}
          </Text>

          <View
            ref={canvasRef}
            collapsable={false}
            style={[styles.canvas, { width: canvasW, height: canvasH }]}
            {...panResponder.panHandlers}
          >
            <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: center.x - SPRITE_BASE / 2,
                top: center.y - SPRITE_BASE / 2,
                transform: [{ scale }, { rotate: `${rotation}deg` }],
              }}
            >
              <CoffeeBuddySprite friend={friend} poseId={poseId} size={SPRITE_BASE} />
            </View>
          </View>

          <View style={styles.controlRow}>
            <Pressable style={styles.controlChip} onPress={shufflePose}>
              <Text style={styles.controlChipText}>🔀 New pose</Text>
            </Pressable>
            <Pressable
              style={styles.controlChip}
              onPress={() => setScale((s) => Math.min(MAX_SCALE, s * 1.2))}
            >
              <Text style={styles.controlChipText}>Bigger</Text>
            </Pressable>
            <Pressable
              style={styles.controlChip}
              onPress={() => setScale((s) => Math.max(MIN_SCALE, s / 1.2))}
            >
              <Text style={styles.controlChipText}>Smaller</Text>
            </Pressable>
            <Pressable style={styles.controlChip} onPress={() => setRotation((r) => r + 15)}>
              <Text style={styles.controlChipText}>Rotate</Text>
            </Pressable>
          </View>

          <View style={styles.buttonRow}>
            <Pressable style={styles.cancelButton} onPress={onCancel} disabled={saving}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={save} disabled={saving}>
              <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save photo'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.xl,
    padding: 16,
    alignItems: 'center',
    maxWidth: 560,
    width: '100%',
  },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.text, fontFamily: FONTS.bold, letterSpacing: 0.7 },
  hint: { fontSize: 12, color: COLORS.textMuted, marginTop: 4, marginBottom: 12, fontFamily: FONTS.regular, letterSpacing: 0.3 },
  canvas: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  controlRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  controlChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: COLORS.surface,
  },
  controlChipText: { fontSize: 12, fontWeight: '600', color: COLORS.text, fontFamily: FONTS.semiBold, letterSpacing: 0.3 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 14, alignSelf: 'stretch' },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 13,
    alignItems: 'center',
  },
  cancelButtonText: { color: COLORS.textMuted, fontWeight: '600', fontSize: 15, fontFamily: FONTS.semiBold, letterSpacing: 0.5 },
  saveButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: 13,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '600', fontSize: 15, fontFamily: FONTS.semiBold, letterSpacing: 0.5 },
});
