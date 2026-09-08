/**
 * Cross-platform PDF save utility.
 *
 * Android: Saves to user's Downloads directory via StorageAccessFramework.
 *          First time prompts user to grant access to Downloads folder.
 *          Permission is persisted so subsequent saves are automatic.
 *
 * iOS: Opens share sheet so user can save to Files or share elsewhere.
 */
import {Platform, Share} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {toastSuccess, toastError} from './toast';

const SAF_KEY = 'munim-saf-directory-uri';

/**
 * Save a PDF to the user's device.
 * @param fileUri - Local URI of the PDF file (from Print.printToFileAsync)
 * @param fileName - Name of the file without extension (e.g. "INV-001")
 */
export async function savePdf(fileUri: string, fileName: string): Promise<boolean> {
  if (Platform.OS === 'android') {
    return saveToAndroidDownloads(fileUri, fileName);
  }
  // iOS — share sheet lets user save to Files
  await Share.share({url: fileUri, message: `${fileName}.pdf`});
  return true;
}

async function saveToAndroidDownloads(fileUri: string, fileName: string): Promise<boolean> {
  try {
    const dirUri = await getOrCreateSafDirectory();
    if (!dirUri) return false;

    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const fileUri2 = await FileSystem.StorageAccessFramework.createFileAsync(
      dirUri,
      fileName,
      'application/pdf',
    );

    await FileSystem.writeAsStringAsync(fileUri2, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    toastSuccess('Saved to Downloads');
    return true;
  } catch {
    toastError('Failed to save file');
    return false;
  }
}

/**
 * Get a previously granted SAF directory, or request a new one.
 * Returns null if user denied permission.
 */
async function getOrCreateSafDirectory(): Promise<string | null> {
  // Check persisted URI
  const saved = await AsyncStorage.getItem(SAF_KEY);
  if (saved) {
    try {
      // Verify it's still valid
      const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(saved);
      if (Array.isArray(files)) return saved;
    } catch {
      // URI invalid — fall through to request fresh permission
      await AsyncStorage.removeItem(SAF_KEY);
    }
  }

  // Request permission — opens Android directory picker
  const result = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

  if (!result.granted) return null;

  // persist the granted URI
  const dirUri = (result as {granted: boolean; directoryUri: string}).directoryUri;
  await AsyncStorage.setItem(SAF_KEY, dirUri);
  return dirUri;
}
