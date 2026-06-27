import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  fetchEnvironmentComponents,
  createEnvironmentComponent,
  fetchExerciseEnvironmentRequirements,
  addExerciseEnvironmentRequirement,
  removeExerciseEnvironmentRequirement,
} from '@/services/api';
import { Plus, Trash2 } from 'lucide-react';

interface EnvironmentComponent {
  id: number;
  name: string;
  slug: string;
  category: string;
  affects_tracking: boolean;
  setup_instructions?: string | null;
}

interface EnvironmentCatalogProps {
  exerciseId?: number | null;
}

export const EnvironmentCatalog: React.FC<EnvironmentCatalogProps> = ({ exerciseId }) => {
  const [components, setComponents] = useState<EnvironmentComponent[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const comps = await fetchEnvironmentComponents();
      setComponents(comps);
      if (exerciseId) {
        const reqs = await fetchExerciseEnvironmentRequirements(exerciseId);
        setRequirements(reqs);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [exerciseId]);

  const handleCreate = async () => {
    if (!newName || !newSlug) return;
    await createEnvironmentComponent({
      name: newName,
      slug: newSlug.toLowerCase().replace(/\s+/g, '_'),
      category: 'equipment',
      affects_tracking: false,
    });
    setNewName('');
    setNewSlug('');
    await load();
  };

  const handleLink = async (componentId: number) => {
    if (!exerciseId) return;
    await addExerciseEnvironmentRequirement(exerciseId, { component_id: componentId, required: true });
    await load();
  };

  const handleUnlink = async (requirementId: number) => {
    if (!exerciseId) return;
    await removeExerciseEnvironmentRequirement(exerciseId, requirementId);
    await load();
  };

  const linkedIds = new Set(requirements.map((r) => r.component_id));

  return (
    <div className="space-y-4 text-left">
      <h4 className="text-xs font-bold uppercase tracking-wider text-chosen-text-muted">Environment Catalog</h4>

      {loading ? (
        <span className="text-xs text-chosen-text-muted">Loading…</span>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {components.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-2.5 bg-chosen-surface border border-chosen rounded-chosen-md text-xs">
              <div>
                <span className="font-medium text-chosen-text-primary">{c.name}</span>
                <div className="flex gap-1 mt-0.5">
                  <Badge variant="neutral">{c.category}</Badge>
                  {c.affects_tracking && <Badge variant="info">tracking</Badge>}
                </div>
              </div>
              {exerciseId && (
                linkedIds.has(c.id) ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-red-500"
                    onClick={() => {
                      const req = requirements.find((r) => r.component_id === c.id);
                      if (req) handleUnlink(req.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="xs" onClick={() => handleLink(c.id)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                )
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 border-t border-chosen pt-3">
        <input
          className="text-xs p-2 bg-chosen-raised border border-chosen rounded-chosen-sm"
          placeholder="Component name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          className="text-xs p-2 bg-chosen-raised border border-chosen rounded-chosen-sm"
          placeholder="slug"
          value={newSlug}
          onChange={(e) => setNewSlug(e.target.value)}
        />
        <Button variant="secondary" size="sm" className="col-span-2" onClick={handleCreate} leftIcon={<Plus className="h-3.5 w-3.5" />}>
          Add Component
        </Button>
      </div>

      {exerciseId && requirements.length > 0 && (
        <p className="text-2xs text-chosen-text-muted">
          {requirements.length} requirement(s) linked to this exercise — shown in patient tracker checklist.
        </p>
      )}
    </div>
  );
};
