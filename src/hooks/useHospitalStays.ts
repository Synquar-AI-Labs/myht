import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface HospitalStay {
  id: string;
  person_name: string;
  date: string;
  start_hour: number;
  end_hour: number;
  is_unavailable: boolean;
  created_at: string;
}

export function useHospitalStays(weekStart: Date, weekEnd: Date) {
  const queryClient = useQueryClient();
  const startStr = format(weekStart, 'yyyy-MM-dd');
  const endStr = format(weekEnd, 'yyyy-MM-dd');

  const { data: stays = [], isLoading } = useQuery({
    queryKey: ['hospital-stays', startStr, endStr],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('hospital_stays')
        .select('*')
        .gte('date', startStr)
        .lte('date', endStr)
        .order('start_hour', { ascending: true });
      if (error) throw error;
      return data as HospitalStay[];
    },
  });

  const addStay = useMutation({
    mutationFn: async (stay: {
      person_name: string;
      date: string;
      start_hour: number;
      end_hour: number;
      is_unavailable: boolean;
    }) => {
      const { error } = await (supabase as any)
        .from('hospital_stays')
        .insert(stay);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital-stays'] });
    },
  });

  const deleteStay = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('hospital_stays')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital-stays'] });
    },
  });

  return { stays, isLoading, addStay, deleteStay };
}
