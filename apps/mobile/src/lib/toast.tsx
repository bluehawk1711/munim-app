/**
 * Toast notification system — visual feedback for success/error actions.
 *
 * Provides a simple toast that appears at the bottom of the screen for
 * success (green) and error (red) notifications. Used to complement haptics
 * with visible feedback.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success('Product saved');
 *   toast.error('Upload failed');
 */

import React, {createContext, useContext, useState, useCallback, useEffect} from 'react';
import {Animated, StyleSheet, Text, View} from 'react-native';
import {colors} from '../theme';
import {rs, spacing} from '../lib/responsive';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastId = 0;

function getToastContext() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

export function useToast(): ToastContextValue {
  return getToastContext();
}

export function ToastProvider({children}: {children: React.ReactNode}) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = String(++toastId);
    setToasts(prev => [...prev, {id, message, type}]);
    // Auto-remove after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    success: (message) => addToast(message, 'success'),
    error: (message) => addToast(message, 'error'),
    info: (message) => addToast(message, 'info'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

const ToastContainer = React.memo(function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: string) => void;
}) {
  return (
    <View style={styles.container}>
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </View>
  );
});

const ToastItem = React.memo(function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: (id: string) => void;
}) {
  const animatedStyle = React.useRef(new Animated.Value(0)).current;
  const bgColor = toast.type === 'success' ? colors.success : toast.type === 'error' ? colors.danger : colors.primary;

  useEffect(() => {
    Animated.timing(animatedStyle, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [animatedStyle]);

  const opacity = animatedStyle.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Animated.View
      style={[
        styles.toast,
        {backgroundColor: bgColor, opacity},
      ]}
      onTouchEnd={() => onRemove(toast.id)}>
      <Text style={styles.message}>{toast.message}</Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: rs(20),
    left: 0,
    right: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 1000,
  },
  toast: {
    borderRadius: rs(8),
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    maxWidth: '90%',
    alignItems: 'center',
  },
  message: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

// Hook for easy access in haptics functions
let toastRef: ToastContextValue | null = null;

/** Register the toast context for use in haptics feedback.
 * Call this from the app root after ToastProvider. */
export function registerToast(toast: ToastContextValue) {
  toastRef = toast;
}

/** Show a success toast if registered, otherwise just haptic.
 * Used as a drop-in replacement for successFeedback in screens. */
export function toastSuccess(message: string) {
  if (toastRef) {
    toastRef.success(message);
  }
}

/** Show an error toast if registered, otherwise just haptic.
 * Used as a drop-in replacement for errorFeedback in screens. */
export function toastError(message: string) {
  if (toastRef) {
    toastRef.error(message);
  }
}
