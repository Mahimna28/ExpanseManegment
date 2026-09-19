import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSyncStore } from '../../stores/sync.store';
import { triggerSync } from '../../sync/engine';
import { RefreshCw, CheckCircle2, AlertTriangle, CloudOff } from 'lucide-react-native';

export function SyncStatusChip() {
  const { status, pendingCount, failedCount, conflictCount } = useSyncStore();

  const handlePress = () => {
    triggerSync().catch(console.warn);
  };

  if (status === 'pushing' || status === 'pulling') {
    return (
      <TouchableOpacity style={[styles.chip, styles.syncing]} onPress={handlePress}>
        <RefreshCw size={13} color="#2563EB" />
        <Text style={[styles.text, styles.textSyncing]}>Syncing...</Text>
      </TouchableOpacity>
    );
  }

  if (failedCount > 0 || conflictCount > 0) {
    return (
      <TouchableOpacity style={[styles.chip, styles.error]} onPress={handlePress}>
        <AlertTriangle size={13} color="#DC2626" />
        <Text style={[styles.text, styles.textError]}>
          {conflictCount > 0 ? `${conflictCount} conflict` : `${failedCount} failed`}
        </Text>
      </TouchableOpacity>
    );
  }

  if (pendingCount > 0) {
    return (
      <TouchableOpacity style={[styles.chip, styles.pending]} onPress={handlePress}>
        <CloudOff size={13} color="#D97706" />
        <Text style={[styles.text, styles.textPending]}>
          {pendingCount} pending
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={[styles.chip, styles.synced]} onPress={handlePress}>
      <CheckCircle2 size={13} color="#059669" />
      <Text style={[styles.text, styles.textSynced]}>Saved</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  synced: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  textSynced: {
    color: '#059669',
  },
  pending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  textPending: {
    color: '#D97706',
  },
  syncing: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  textSyncing: {
    color: '#2563EB',
  },
  error: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  textError: {
    color: '#DC2626',
  },
});
