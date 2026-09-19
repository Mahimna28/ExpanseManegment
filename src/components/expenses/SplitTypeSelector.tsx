import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { SplitType } from '../../types/models';

interface Props {
  value: SplitType;
  onChange: (type: SplitType) => void;
}

export function SplitTypeSelector({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, value === 'equal' && styles.buttonActive]}
        onPress={() => onChange('equal')}
      >
        <Text style={[styles.label, value === 'equal' && styles.labelActive]}>
          Split Equally
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, value === 'custom' && styles.buttonActive]}
        onPress={() => onChange('custom')}
      >
        <Text style={[styles.label, value === 'custom' && styles.labelActive]}>
          Custom Amounts
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    gap: 4,
  },
  button: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 6,
  },
  buttonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  labelActive: {
    color: '#0F172A',
    fontWeight: '600',
  },
});
