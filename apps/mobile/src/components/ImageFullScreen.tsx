/**
 * ImageFullScreen — lightweight fullscreen image viewer.
 *
 * Tap backdrop or ✕ to close. Image is centered and scales to fit.
 */

import React from 'react';
import {Modal, Pressable, StyleSheet, View, Image, useWindowDimensions} from 'react-native';
import {X} from 'lucide-react-native';
import {colors} from './ui';
import {rs, radii} from '../lib/responsive';

type Props = {
  visible: boolean;
  imageUrl: string | null;
  onClose: () => void;
};

export function ImageFullScreen({visible, imageUrl, onClose}: Props) {
  const {width, height} = useWindowDimensions();

  if (!imageUrl) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Close button */}
        <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
          <X size={rs(22)} color="#fff" strokeWidth={2.5} />
        </Pressable>

        {/* Image — stops press from propagating to backdrop */}
        <Pressable onPress={() => {}} style={styles.imageWrap}>
          <Image
            source={{uri: imageUrl}}
            style={{width: width * 0.92, height: height * 0.7}}
            resizeMode="contain"
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: rs(52),
    right: rs(16),
    width: rs(40),
    height: rs(40),
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  imageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
