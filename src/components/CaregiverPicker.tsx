import type { HouseholdPerson } from '@/hooks/HouseholdProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function CaregiverPicker({ people, value, onChange }: {
  people: HouseholdPerson[]; value?: string; onChange: (id: string) => void;
}) {
  return <Select value={value ?? ''} onValueChange={onChange}>
    <SelectTrigger><SelectValue placeholder="Choose who's logging" /></SelectTrigger>
    <SelectContent>{people.map(person =>
      <SelectItem key={person.caregiver_id} value={person.caregiver_id}>{person.display_name}</SelectItem>
    )}</SelectContent>
  </Select>;
}
