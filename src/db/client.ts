import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

const DB_NAME = 'expenseshare_local.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    if (Platform.OS === 'web') {
      // In web fallback, openDatabaseSync still creates an in-memory/WASM database if supported
      dbInstance = SQLite.openDatabaseSync(DB_NAME);
    } else {
      dbInstance = SQLite.openDatabaseSync(DB_NAME);
    }
  }
  return dbInstance;
}
