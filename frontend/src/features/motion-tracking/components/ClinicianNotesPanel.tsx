import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { Stethoscope } from 'lucide-react';
import type { FrameAnnotation } from './FrameAnnotationEditor';

interface ClinicianNotesPanelProps {
  annotations: FrameAnnotation[];
  onJumpToFrame?: (frame: number) => void;
}

export const ClinicianNotesPanel: React.FC<ClinicianNotesPanelProps> = ({
  annotations,
  onJumpToFrame,
}) => {
  if (annotations.length === 0) {
    return (
      <div className="text-center py-8 text-chosen-text-muted">
        <Stethoscope className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No clinician notes for this session yet.</p>
        <p className="text-2xs mt-1">Your care team may add frame-specific feedback after review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-left">
      <p className="text-xs text-chosen-text-muted">
        Notes from your clinician on specific frames during this session.
      </p>
      {annotations.map((ann) => (
        <button
          key={ann.id}
          type="button"
          onClick={() => onJumpToFrame?.(ann.frame_number)}
          className="w-full text-left p-3 bg-chosen-surface border border-chosen rounded-chosen-md hover:border-gold-500/30 transition-all"
        >
          <div className="flex items-center gap-2 mb-1">
            <Stethoscope className="h-3.5 w-3.5 text-gold-500" />
            <span className="text-xs font-bold text-gold-500">Frame #{ann.frame_number + 1}</span>
            {ann.issue_tags && ann.issue_tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {ann.issue_tags.map((tag) => (
                  <Badge key={tag} variant="warning">{tag.replace(/_/g, ' ')}</Badge>
                ))}
              </div>
            )}
          </div>
          {ann.notes && <p className="text-sm text-chosen-text-primary">{ann.notes}</p>}
          {ann.suggestions && (
            <p className="text-xs text-chosen-text-secondary mt-1.5 pl-3 border-l-2 border-gold-500/40">
              <span className="font-semibold text-gold-500">Try this: </span>
              {ann.suggestions}
            </p>
          )}
          <span className="text-2xs text-chosen-text-muted block mt-2">
            {ann.created_by} · {new Date(ann.created_at).toLocaleDateString()}
          </span>
        </button>
      ))}
    </div>
  );
};
