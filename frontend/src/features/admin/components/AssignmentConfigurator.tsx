import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { updateExerciseAssignment } from '@/services/api';
import type { AssignmentConfig } from '@/types/api';

interface AssignmentConfiguratorProps {
  patientId: string;
  assignmentId: number;
  initialConfig?: AssignmentConfig | null;
  onSaved: () => void;
}

export const AssignmentConfigurator: React.FC<AssignmentConfiguratorProps> = ({
  patientId,
  assignmentId,
  initialConfig,
  onSaved,
}) => {
  const [sets, setSets] = useState(String(initialConfig?.sets ?? 3));
  const [reps, setReps] = useState(String(initialConfig?.reps ?? 10));
  const [romOverride, setRomOverride] = useState(
    initialConfig?.target_rom_override != null ? String(initialConfig.target_rom_override) : ''
  );
  const [notes, setNotes] = useState(initialConfig?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateExerciseAssignment(patientId, assignmentId, {
        config: {
          sets: parseInt(sets, 10) || 3,
          reps: parseInt(reps, 10) || 10,
          target_rom_override: romOverride ? parseFloat(romOverride) : undefined,
          notes: notes || undefined,
        },
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 text-left border-t border-chosen pt-4 mt-4">
      <h4 className="text-xs font-bold uppercase tracking-wider text-chosen-text-muted">Prescription Config</h4>
      <div className="grid grid-cols-3 gap-2">
        <Input label="Sets" value={sets} onChange={(e) => setSets(e.target.value)} />
        <Input label="Reps" value={reps} onChange={(e) => setReps(e.target.value)} />
        <Input label="ROM override (°)" value={romOverride} onChange={(e) => setRomOverride(e.target.value)} />
      </div>
      <Input label="Clinical notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Button variant="secondary" size="sm" onClick={handleSave} disabled={saving}>
        Save Prescription
      </Button>
    </div>
  );
};
