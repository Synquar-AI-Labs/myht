import { useState } from 'react';
import { useHousehold } from '@/hooks/HouseholdProvider';
import { chooseCaregiver } from '@/lib/caregiverChoice';

export function useCaregiverChoice() {
  const { householdId, caregivers, myCaregiver } = useHousehold();
  const key = 'ht_caregiver:' + householdId;
  const [choice, setChoice] = useState<{ key: string; id: string } | null>(null);
  const activeCaregivers = caregivers.filter(person => person.is_active);
  const caregiver = chooseCaregiver(caregivers, choice?.key === key ? choice.id : localStorage.getItem(key), myCaregiver?.caregiver_id);
  const selectCaregiver = (id: string) => {
    if (!activeCaregivers.some(person => person.caregiver_id === id)) return;
    localStorage.setItem(key, id);
    setChoice({ key, id });
  };
  return { activeCaregivers, caregiver, selectCaregiver };
}
