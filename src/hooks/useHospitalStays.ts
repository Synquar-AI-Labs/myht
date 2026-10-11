import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useHousehold } from '@/hooks/HouseholdProvider';
import { domainKeys } from '@/lib/domainKeys';
import { fetchAllRows } from '@/lib/fetchAll';

export interface HospitalStay {
  id: string;
  person_name: string;
  caregiver_id: string | null;
  date: string;
  start_hour: number;
  end_hour: number;
  is_unavailable: boolean;
  created_at: string;
}

export function useHospitalStays(weekStart: Date, weekEnd: Date) {
  const queryClient = useQueryClient();
  const { householdId, caregivers } = useHousehold();
  const startStr = format(weekStart, 'yyyy-MM-dd');
  const endStr = format(weekEnd, 'yyyy-MM-dd');

  const { data: stays = [], isLoading } = useQuery({
    queryKey: [...domainKeys.stays(householdId), startStr, endStr],
    enabled: !!householdId,
    queryFn: async () => {
      return fetchAllRows<HospitalStay>((from, to) => supabase
        .from('hospital_stays')
        .select('*', { count: 'exact' })
        .eq('household_id', householdId!)
        .gte('date', startStr)
        .lte('date', endStr)
        .order('start_hour', { ascending: true }).order('id')
        .range(from, to));
    },
  });

  const addStay = useMutation({
    mutationFn: async (stays: {
      person_name: string;
      caregiver_id: string;
      date: string;
      start_hour: number;
      end_hour: number;
      is_unavailable: boolean;
    }[]) => {
      if (!householdId) throw new Error('No family selected');
      const rows = stays.map(stay => {
        const person = caregivers.find(p => p.is_active && p.caregiver_id === stay.caregiver_id);
        if (!person) throw new Error('Choose a person in this family');
        return { ...stay, household_id: householdId, person_name: person.display_name };
      });
      const { error } = await supabase
        .from('hospital_stays')
        .insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: domainKeys.stays(householdId) });
      queryClient.invalidateQueries({ queryKey: domainKeys.staysSummary(householdId) });
    },
  });

  const deleteStay = useMutation({
    mutationFn: async (id: string) => {
      if (!householdId) throw new Error('No family selected');
      const { error } = await supabase
        .from('hospital_stays')
        .delete()
        .eq('household_id', householdId)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: domainKeys.stays(householdId) });
      queryClient.invalidateQueries({ queryKey: domainKeys.staysSummary(householdId) });
    },
  });

  return { stays, isLoading, addStay, deleteStay };
}
