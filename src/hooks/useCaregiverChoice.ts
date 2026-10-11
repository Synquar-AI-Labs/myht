import { useSyncExternalStore } from 'react';
import { useHousehold } from '@/hooks/HouseholdProvider';
import { chooseCaregiver } from '@/lib/caregiverChoice';

function subscribe(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener('ht-caregiver-changed', listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener('ht-caregiver-changed', listener);
  };
}

export function useCaregiverChoice() {
  const { householdId, caregivers, myCaregiver } = useHousehold();
  const key = 'ht_caregiver:' + householdId;
  const remembered = useSyncExternalStore(subscribe, () => localStorage.getItem(key), () => null);
  const activeCaregivers = caregivers.filter(person => person.is_active);
  const caregiver = chooseCaregiver(caregivers, remembered, myCaregiver?.caregiver_id);
  const selectCaregiver = (id: string) => {
    if (!activeCaregivers.some(person => person.caregiver_id === id)) return;
    localStorage.setItem(key, id);
    window.dispatchEvent(new Event('ht-caregiver-changed'));
  };
  return { activeCaregivers, caregiver, selectCaregiver };
}
