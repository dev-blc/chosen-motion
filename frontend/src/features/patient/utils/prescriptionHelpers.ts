import type { Prescription } from '@/types/api';

/** Fallback metadata when prescription API is unavailable. */
const DEFAULT_META = {
  sets: 3,
  reps: 10,
  rest: '30s',
  difficulty: 'Light',
  duration: '5 mins',
  bodyPart: 'General',
  category: 'Rehabilitation',
};

const DEFAULT_GUIDE = {
  description: '',
  instructions: [] as string[],
  preparationTips: [] as string[],
  commonMistakes: [] as string[],
  safetyNotes: [] as string[],
  targetMuscles: [] as string[],
  requiredEquipment: 'None (Bodyweight)',
};

export function metadataFromPrescription(prescription?: Prescription | null) {
  if (!prescription) return DEFAULT_META;
  const cfg = prescription.config || {};
  return {
    sets: cfg.sets ?? DEFAULT_META.sets,
    reps: cfg.reps ?? DEFAULT_META.reps,
    rest: cfg.rest_seconds ? `${cfg.rest_seconds}s` : DEFAULT_META.rest,
    difficulty: cfg.difficulty ?? DEFAULT_META.difficulty,
    duration: cfg.duration ?? DEFAULT_META.duration,
    bodyPart: cfg.body_part ?? DEFAULT_META.bodyPart,
    category: cfg.category ?? DEFAULT_META.category,
  };
}

export function guideFromPrescription(prescription?: Prescription | null) {
  if (!prescription) return DEFAULT_GUIDE;
  const g = prescription.guide || {};
  const envNames = (prescription.environment_requirements || [])
    .filter((r) => r.required !== false)
    .map((r) => r.name)
    .filter(Boolean);

  const equipment =
    envNames.length > 0
      ? envNames.join(', ')
      : g.required_equipment || DEFAULT_GUIDE.requiredEquipment;

  return {
    description: g.description || '',
    instructions: g.instructions || [],
    preparationTips: g.preparation_tips || [],
    commonMistakes: g.common_mistakes || [],
    safetyNotes: g.safety_notes || [],
    targetMuscles: g.target_muscles || [],
    requiredEquipment: equipment,
  };
}

export function limitationsFromPrescription(prescription?: Prescription | null) {
  return prescription?.limitations || [];
}
