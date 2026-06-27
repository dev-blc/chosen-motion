import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { createFrameAnnotation, deleteFrameAnnotation } from '@/services/api';
import { ISSUE_TAG_OPTIONS } from '@/features/admin/components/PatientLimitations';
import { MapPin, Plus, Trash2 } from 'lucide-react';

export interface FrameAnnotation {
  id: number;
  session_id: number;
  patient_id: string;
  frame_number: number;
  issue_tags?: string[] | null;
  notes?: string | null;
  suggestions?: string | null;
  created_by?: string | null;
  visible_to_patient: boolean;
  created_at: string;
  updated_at: string;
}

interface FrameAnnotationEditorProps {
  sessionId: number;
  currentFrame: number;
  annotations: FrameAnnotation[];
  onSaved: () => void;
  onJumpToFrame: (frame: number) => void;
}

export const FrameAnnotationEditor: React.FC<FrameAnnotationEditorProps> = ({
  sessionId,
  currentFrame,
  annotations,
  onSaved,
  onJumpToFrame,
}) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [visibleToPatient, setVisibleToPatient] = useState(true);
  const [saving, setSaving] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = async () => {
    if (!notes && !suggestions && selectedTags.length === 0) return;
    setSaving(true);
    try {
      await createFrameAnnotation(sessionId, {
        frame_number: currentFrame,
        issue_tags: selectedTags,
        notes: notes || undefined,
        suggestions: suggestions || undefined,
        visible_to_patient: visibleToPatient,
      });
      setNotes('');
      setSuggestions('');
      setSelectedTags([]);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (annotationId: number) => {
    if (!confirm('Delete this annotation?')) return;
    await deleteFrameAnnotation(sessionId, annotationId);
    onSaved();
  };

  return (
    <div className="space-y-4 text-left">
      <div className="p-3 bg-gold-500/5 border border-gold-500/20 rounded-chosen-md">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="h-4 w-4 text-gold-500" />
          <span className="text-xs font-bold text-chosen-text-primary">
            Annotate Frame #{currentFrame + 1}
          </span>
        </div>

        <div className="mb-3">
          <span className="text-2xs text-chosen-text-muted uppercase font-bold block mb-1.5">Issue Tags</span>
          <div className="flex flex-wrap gap-1.5">
            {ISSUE_TAG_OPTIONS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-2 py-1 text-2xs font-bold rounded-chosen-sm border transition-all ${
                  selectedTags.includes(tag)
                    ? 'bg-gold-500/20 border-gold-500/40 text-gold-500'
                    : 'bg-chosen-surface border-chosen text-chosen-text-muted hover:text-chosen-text-primary'
                }`}
              >
                {tag.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        <Input label="Clinical notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Input label="Suggestions for patient" value={suggestions} onChange={(e) => setSuggestions(e.target.value)} className="mt-2" />

        <label className="flex items-center gap-2 mt-2 text-xs text-chosen-text-secondary">
          <input
            type="checkbox"
            checked={visibleToPatient}
            onChange={(e) => setVisibleToPatient(e.target.checked)}
            className="rounded border-chosen"
          />
          Visible on patient dashboard / replay
        </label>

        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={handleSave}
          disabled={saving}
          leftIcon={<Plus className="h-3.5 w-3.5" />}
        >
          Save Annotation
        </Button>
      </div>

      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-chosen-text-muted mb-2">
          Session Annotations ({annotations.length})
        </h4>
        {annotations.length === 0 ? (
          <p className="text-xs text-chosen-text-muted">No frame notes yet. Scrub to a frame and add observations.</p>
        ) : (
          <div className="space-y-2">
            {annotations.map((ann) => (
              <div
                key={ann.id}
                className="p-3 bg-chosen-surface border border-chosen rounded-chosen-md hover:border-gold-500/30 transition-all cursor-pointer"
                onClick={() => onJumpToFrame(ann.frame_number)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-gold-500">Frame #{ann.frame_number + 1}</span>
                    {ann.issue_tags && ann.issue_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {ann.issue_tags.map((tag) => (
                          <Badge key={tag} variant="warning">{tag.replace(/_/g, ' ')}</Badge>
                        ))}
                      </div>
                    )}
                    {ann.notes && <p className="text-xs text-chosen-text-primary mt-1.5">{ann.notes}</p>}
                    {ann.suggestions && (
                      <p className="text-2xs text-chosen-text-muted mt-1 italic">Suggestion: {ann.suggestions}</p>
                    )}
                    <span className="text-2xs text-chosen-text-muted block mt-1">
                      {ann.created_by} · {new Date(ann.created_at).toLocaleDateString()}
                      {!ann.visible_to_patient && ' · Hidden from patient'}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-red-500 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(ann.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
