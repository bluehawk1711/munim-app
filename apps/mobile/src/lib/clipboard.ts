/**
 * Clipboard helper — thin wrapper over React Native's built-in Clipboard.
 *
 * The module still exists in RN core (with a deprecation warning for future
 * removal); wrapping it here keeps a single migration point if we ever move to
 * @react-native-clipboard/clipboard, without adding a new dependency today.
 */
import {Clipboard} from 'react-native';

export async function copyText(text: string): Promise<boolean> {
  try {
    Clipboard.setString(text);
    return true;
  } catch {
    return false;
  }
}
