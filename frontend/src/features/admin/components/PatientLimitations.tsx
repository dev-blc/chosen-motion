import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  createPatientLimitation,
  deletePatientLimitation,
  fetchPatientLimitations,
  updatePatientLimitation,
} from '@/services/api';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';

interface PatientLimitation {
  id: number;
  patient_id: string;
  scope_type: string;
  scope_id?: number | null;
  limitation_type: string;
  parameters: Record<string, unknown>;
  notes?: string | null;
  active: boolean;
  created_by?: string | null;
  created_at: string;
}

interface PatientLimitationsProps {
  patientId: string;
  exerciseOptions?: Array<{ id: number; name: string }>;
}

const LIMITATION_TYPES = [
  { value: 'rom_cap', label: 'ROM cap (max degrees)' },
  { value: 'rom_floor', label: 'ROM floor (min degrees)' },
  { value: 'symmetry_min', label: 'Minimum symmetry %' },
  { value: 'speed_max', label: 'Max speed (°/s)' },
  { value: 'joint_avoid', label: 'Joint angle caution' },
];

const ISSUE_TAG_OPTIONS = ['knee_valgus', 'torso_lean', 'hip_rotation', 'shoulder_comp', 'incomplete_rom'];

export const PatientLimitations: React.FC<PatientLimitationsProps> = ({
  patientId,
  exerciseOptions = [],
}) => {
  const [limitations, setLimitations] = useState<PatientLimitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [scopeType, setScopeType] = useState('global');
  const [scopeId, setScopeId] = useState('');
  const [limitationType, setLimitationType] = useState('rom_cap');
  const [paramValue, setParamValue] = useState('');
  const [jointName, setJointName] = useState('knee');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchPatientLimitations(patientId);
      setLimitations(data);
    } catch (err) {
      console.warn('Failed to load limitations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (patientId) load();
  }, [patientId]);

  const buildParameters = () => {
    if (limitationType === 'joint_avoid') {
      return { joint: jointName, max_angle: parseFloat(paramValue) || 90 };
    }
    const key =
      limitationType === 'rom_cap'
        ? 'max_rom'
        : limitationType === 'rom_floor'
          ? 'min_rom'
          : limitationType === 'symmetry_min'
            ? 'min_symmetry'
            : 'max_speed';
    return { [key]: parseFloat(paramValue) || 0, value: parseFloat(paramValue) || 0 };
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await createPatientLimitation(patientId, {
        scope_type: scopeType,
        scope_id: scopeType === 'exercise' && scopeId ? parseInt(scopeId, 10) : undefined,
        limitation_type: limitationType,
        parameters: buildParameters(),
        notes: notes || undefined,
        active: true,
      });
      setShowForm(false);
      setParamValue('');
      setNotes('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (lim: PatientLimitation) => {
    await updatePatientLimitation(patientId, lim.id, { active: !lim.active });
    await load();
  };

  const handleDelete = async (limId: number) => {
    if (!confirm('Remove this limitation?')) return;
    await deletePatientLimitation(patientId, limId);
    await load();
  };

  const formatLimitation = (lim: PatientLimitation) => {
    const p = lim.parameters || {};
    if (lim.limitation_type === 'rom_cap') return `Max ROM ${p.max_rom ?? p.value}°`;
    if (lim.limitation_type === 'rom_floor') return `Min ROM ${p.min_rom ?? p.value}°`;
    if (lim.limitation_type === 'symmetry_min') return `Min symmetry ${p.min_symmetry ?? p.value}%`;
    if (lim.limitation_type === 'speed_max') return `Max speed ${p.max_speed ?? p.value}°/s`;
    if (lim.limitation_type === 'joint_avoid') return `Caution: ${p.joint} > ${p.max_angle}°`;
    return lim.limitation_type;
  };

  return (
    <div className="space-y-3 text-left border-t border-chosen pt-4 mt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-chosen-text-muted flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          Patient Limitations
        </h4>
        <Button variant="ghost" size="xs" onClick={() => setShowForm(!showForm)} leftIcon={<Plus className="h-3.5 w-3.5" />}>
          {showForm ? 'Cancel' : 'Add'}
        </Button>
      </div>

      {showForm && (
        <div className="space-y-2 p-3 bg-chosen-surface rounded-chosen-md border border-chosen">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-2xs text-chosen-text-muted">
              Scope
              <select
                className="w-full mt-1 text-xs bg-chosen-raised border border-chosen rounded-chosen-sm p-2"
                value={scopeType}
                onChange={(e) => setScopeType(e.target.value)}
              >
                <option value="global">Global (all exercises)</option>
                <option value="exercise">Specific exercise</option>
              </select>
            </label>
            {scopeType === 'exercise' && (
              <label className="text-2xs text-chosen-text-muted">
                Exercise
                <select
                  className="w-full mt-1 text-xs bg-chosen-raised border border-chosen rounded-chosen-sm p-2"
                  value={scopeId}
                  onChange={(e) => setScopeId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {exerciseOptions.map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <label className="text-2xs text-chosen-text-muted block">
            Type
            <select
              className="w-full mt-1 text-xs bg-chosen-raised border border-chosen rounded-chosen-sm p-2"
              value={limitationType}
              onChange={(e) => setLimitationType(e.target.value)}
            >
              {LIMITATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          {limitationType === 'joint_avoid' ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-2xs text-chosen-text-muted">
                Joint
                <select
                  className="w-full mt-1 text-xs bg-chosen-raised border border-chosen rounded-chosen-sm p-2"
                  value={jointName}
                  onChange={(e) => setJointName(e.target.value)}
                >
                  {['elbow', 'shoulder', 'hip', 'knee'].map((j) => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                </select>
              </label>
              <Input label="Max angle (°)" value={paramValue} onChange={(e) => setParamValue(e.target.value)} />
            </div>
          ) : (
            <Input label="Threshold value" value={paramValue} onChange={(e) => setParamValue(e.target.value)} />
          )}
          <Input label="Clinical notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button variant="secondary" size="sm" onClick={handleCreate} disabled={saving}>
            Save Limitation
          </Button>
        </div>
      )}

      {loading ? (
        <span className="text-xs text-chosen-text-muted">Loading limitations…</span>
      ) : limitations.length === 0 ? (
        <span className="text-xs text-chosen-text-muted">No active limitations configured.</span>
      ) : (
        <div className="space-y-2">
          {limitations.map((lim) => (
            <div key={lim.id} className="flex items-start justify-between gap-2 p-2.5 bg-chosen-surface rounded-chosen-md border border-chosen text-xs">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant={lim.active ? 'warning' : 'neutral'}>{lim.scope_type}</Badge>
                  <span className="font-medium text-chosen-text-primary">{formatLimitation(lim)}</span>
                </div>
                {lim.notes && <p className="text-2xs text-chosen-text-muted mt-1">{lim.notes}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="xs" onClick={() => handleToggleActive(lim)}>
                  {lim.active ? 'Pause' : 'Enable'}
                </Button>
                <Button variant="ghost" size="xs" className="text-red-500" onClick={() => handleDelete(lim.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-2xs text-chosen-text-muted">
        Limitations merge into prescription rules and flag sessions that exceed patient-specific thresholds.
      </p>
    </div>
  );
};

export { ISSUE_TAG_OPTIONS };
