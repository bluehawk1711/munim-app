/**
 * BarcodeScannerModal — full-screen camera scanner shared by every
 * scan-to-act flow (Home scan-to-sell, Inventory scan-to-sell).
 *
 * Owns camera-permission handling (requests on first open) and the framed
 * viewfinder UI. The parent decides what a detected code means via
 * `onDetected`; an optional `message` renders under the frame (e.g. lookup
 * errors) while the parent keeps the scanner open for another try.
 *
 * All colors are theme tokens.
 */

import React, {useEffect} from 'react';
import {Modal, StyleSheet, Text, View} from 'react-native';
import {CameraView, useCameraPermissions} from 'expo-camera';
import {Barcode as BarcodeIcon} from 'lucide-react-native';
import {Button, colors} from './ui';
import {useThemeStyles} from '../theme';
import {rw, rs, spacing, typography, radii} from '../lib/responsive';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called with each detected barcode payload. */
  onDetected: (code: string) => void;
  /** Optional status line under the frame (scan errors, hints…). */
  message?: string;
  /** Heading inside the viewfinder. */
  title?: string;
};

export function BarcodeScannerModal({
  visible,
  onClose,
  onDetected,
  message,
  title = 'Point at a product barcode',
}: Props) {
  const styles = useThemeStyles(makeStyles);
  const [permission, requestPermission] = useCameraPermissions();

  // Ask for permission the first time the scanner opens.
  useEffect(() => {
    if (visible && !permission?.granted) void requestPermission();
  }, [visible, permission?.granted, requestPermission]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr']}}
            onBarcodeScanned={({data}) => onDetected(data)}>
            <View style={styles.overlay}>
              <View style={styles.frame} />
              <Text style={styles.title}>{title}</Text>
              {message ? <Text style={styles.msg}>{message}</Text> : null}
              <Button title="Cancel" variant="outline" onPress={onClose} style={{marginTop: spacing.lg, width: '100%'}} />
            </View>
          </CameraView>
        ) : (
          <View style={styles.perm}>
            <BarcodeIcon size={rs(40)} color={colors.muted} />
            <Text style={styles.title}>Camera permission needed</Text>
            <Button title="Allow camera" onPress={() => void requestPermission()} style={{marginTop: spacing.md, width: '100%'}} />
            <Button title="Cancel" variant="outline" onPress={onClose} style={{marginTop: spacing.sm, width: '100%'}} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    root: {flex: 1, backgroundColor: colors.inverseSurface},
    overlay: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl},
    frame: {
      width: rw(260),
      height: rs(160),
      borderWidth: 3,
      borderColor: colors.primary,
      borderRadius: radii.xl,
      marginBottom: spacing.xl,
    },
    title: {fontSize: typography.body, fontWeight: '600', color: colors.inverseOnSurface, textAlign: 'center'},
    msg: {fontSize: typography.secondary, color: colors.warning, marginTop: spacing.md, textAlign: 'center'},
    perm: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl},
  });
