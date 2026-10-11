const COLORS = ['#3B82F6', '#22C55E', '#F97316', '#A855F7', '#EC4899', '#14B8A6', '#EAB308'];

/** Stable across list ordering, renames and adding/removing other caregivers. */
export function caregiverColor(id: string | null | undefined) {
  if (!id) return '#888';
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}
