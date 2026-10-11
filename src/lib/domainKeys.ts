export const domainKeys = {
  invites: (id?: string) => ['household', id, 'household_invites'] as const,
  appointments: (id?: string) => ['household', id, 'appointments'] as const,
  stays: (id?: string) => ['household', id, 'hospital-stays'] as const,
  staysSummary: (id?: string) => ['household', id, 'hospital-stays-summary'] as const,
  notes: (id?: string) => ['household', id, 'written-notes'] as const,
  actions: (id?: string) => ['household', id, 'custom_actions'] as const,
  actionLogs: (id?: string) => ['household', id, 'custom_action_logs'] as const,
  transcripts: (id?: string) => ['household', id, 'audio_transcripts'] as const,
  transcriptCount: (id?: string) => ['household', id, 'audio_transcripts-count'] as const,
};
