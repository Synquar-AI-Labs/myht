import type { HouseholdPerson } from '@/hooks/HouseholdProvider';

export function chooseCaregiver(people: HouseholdPerson[], remembered: string | null, ownId?: string) {
  const active = people.filter(person => person.is_active);
  return active.find(person => person.caregiver_id === remembered)
    ?? active.find(person => person.caregiver_id === ownId);
}

export function changedCaregiverId(selected?: string | null, original?: string | null) {
  return selected && selected !== original ? selected : undefined;
}

export function attributionForEdit(people: HouseholdPerson[], selected: string | undefined, existing: string | null) {
  if (selected === undefined) return {};
  const person = people.find(p => p.caregiver_id === selected && (p.is_active || p.caregiver_id === existing));
  if (!person) throw new Error('Choose a person in this family');
  return { caregiver_id: person.caregiver_id, recorded_by: person.display_name };
}
