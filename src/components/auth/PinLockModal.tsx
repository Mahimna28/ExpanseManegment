import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { useAppLock } from '../../hooks/useAppLock';
import { Lock, Fingerprint } from 'lucide-react-native';
import { colors, radii, spacing, typography, shadows } from '../../theme';

export function PinLockModal() {
  const {
    appLockStatus,
    authenticateWithBiometrics,
    verifyPin,
  } = useAppLock();

  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const isVisible = appLockStatus === 'locked';

  // Automatically trigger biometrics when locked modal appears
  useEffect(() => {
    if (isVisible) {
      authenticateWithBiometrics().then((success) => {
        if (success) {
          setPin('');
          setError(false);
        }
      });
    }
  }, [isVisible]);

  const handleUnlock = async () => {
    if (pin.length < 4) {
      setError(true);
      return;
    }
    const success = await verifyPin(pin);
    if (success) {
      setPin('');
      setError(false);
    } else {
      setError(true);
      setPin('');
      Alert.alert('Incorrect PIN', 'Please try again.');
    }
  };

  if (!isVisible) return null;

  return (
    <Modal visible={isVisible} animationType="fade" transparent={false}>
      <View style={styles.container}>
        <View style={[styles.iconCircle, shadows.subtle]}>
          <Lock size={32} color={colors.primary} />
        </View>

        <Text style={styles.title}>ExpenseShare is Locked</Text>
        <Text style={styles.subtitle}>Enter your PIN to access your expenses</Text>

        <TextInput
          style={[styles.pinInput, error && styles.pinInputError]}
          value={pin}
          onChangeText={(text) => {
            setError(false);
            setPin(text.replace(/[^0-9]/g, ''));
          }}
          placeholder="••••"
          placeholderTextColor={colors.textDim}
          keyboardType="numeric"
          secureTextEntry
          maxLength={6}
          autoFocus
          onSubmitEditing={handleUnlock}
        />

        <TouchableOpacity
          style={[styles.unlockButton, shadows.subtle]}
          onPress={handleUnlock}
          activeOpacity={0.8}
        >
          <Text style={styles.unlockButtonText}>Unlock</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.biometricButton}
          onPress={() => authenticateWithBiometrics()}
          activeOpacity={0.7}
        >
          <Fingerprint size={20} color={colors.primary} />
          <Text style={styles.biometricText}>Use Biometrics</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 32,
    textAlign: 'center',
  },
  pinInput: {
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 8,
    width: 200,
    paddingVertical: 14,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 20,
  },
  pinInputError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  unlockButton: {
    backgroundColor: colors.primary,
    width: 200,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
    marginBottom: 16,
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
  biometricText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
