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
        <View style={styles.iconCircle}>
          <Lock size={32} color="#2563EB" />
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
          placeholderTextColor="#94A3B8"
          keyboardType="numeric"
          secureTextEntry
          maxLength={6}
          autoFocus
          onSubmitEditing={handleUnlock}
        />

        <TouchableOpacity style={styles.unlockButton} onPress={handleUnlock}>
          <Text style={styles.unlockButtonText}>Unlock</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.biometricButton}
          onPress={() => authenticateWithBiometrics()}
        >
          <Fingerprint size={20} color="#2563EB" />
          <Text style={styles.biometricText}>Use Biometrics</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 32,
    textAlign: 'center',
  },
  pinInput: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 8,
    width: 180,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#334155',
    marginBottom: 24,
  },
  pinInputError: {
    borderColor: '#EF4444',
  },
  unlockButton: {
    backgroundColor: '#2563EB',
    width: 180,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
  biometricText: {
    color: '#60A5FA',
    fontSize: 14,
    fontWeight: '500',
  },
});
