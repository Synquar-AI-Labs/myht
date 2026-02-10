import { useState, useEffect, useCallback } from 'react';
import { HealthRecord } from '@/types/health';

const STORAGE_KEY = 'health-records';

function loadRecords(): HealthRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveRecords(records: HealthRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function useHealthRecords() {
  const [records, setRecords] = useState<HealthRecord[]>(loadRecords);

  useEffect(() => {
    saveRecords(records);
  }, [records]);

  const addRecord = useCallback((record: Omit<HealthRecord, 'id' | 'createdAt'>) => {
    const newRecord: HealthRecord = {
      ...record,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setRecords(prev => {
      const filtered = prev.filter(r => r.date !== record.date);
      return [...filtered, newRecord].sort((a, b) => b.date.localeCompare(a.date));
    });
  }, []);

  const updateRecord = useCallback((id: string, updates: Partial<HealthRecord>) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, []);

  const deleteRecord = useCallback((id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
  }, []);

  const getLatestRecord = useCallback(() => {
    return records.length > 0 ? records[0] : null;
  }, [records]);

  const getRecordByDate = useCallback((date: string) => {
    return records.find(r => r.date === date) || null;
  }, [records]);

  return { records, addRecord, updateRecord, deleteRecord, getLatestRecord, getRecordByDate };
}
