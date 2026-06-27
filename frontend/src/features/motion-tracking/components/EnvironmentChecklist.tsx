import React, { useState } from 'react';
import { Package, Volume2, Users, Eye } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export interface EnvironmentRequirement {
  slug: string;
  name: string;
  category?: string;
  required?: boolean;
  affects_tracking?: boolean;
  setup_instructions?: string;
}

export interface EnvironmentSelection {
  declared_components: string[];
  noise_level: number;
  mirror_present: boolean;
  other_users_present: boolean;
}

interface EnvironmentChecklistProps {
  exerciseName: string;
  requirements?: EnvironmentRequirement[];
  captureGuidance?: Record<string, unknown>;
  onContinue: (selection: EnvironmentSelection) => void;
  onBack: () => void;
}

export const EnvironmentChecklist: React.FC<EnvironmentChecklistProps> = ({
  exerciseName,
  requirements = [],
  captureGuidance = {},
  onContinue,
  onBack,
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [noiseLevel, setNoiseLevel] = useState(2);
  const [mirrorPresent, setMirrorPresent] = useState(false);
  const [othersPresent, setOthersPresent] = useState(false);

  const toggle = (slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const handleContinue = () => {
    const slugs = [...selected];
    if (mirrorPresent && !slugs.includes('mirror')) slugs.push('mirror');
    if (othersPresent && !slugs.includes('crowded_gym')) slugs.push('crowded_gym');
    onContinue({
      declared_components: slugs,
      noise_level: noiseLevel,
      mirror_present: mirrorPresent,
      other_users_present: othersPresent,
    });
  };

  const cameraAngle = (captureGuidance.camera_angle as string) || 'side_left';
  const stance = (captureGuidance.stance as string) || 'standing';

  return (
    <div className="min-h-screen bg-[#0d0c18] text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-lg w-full bg-[#121122] border border-slate-850 rounded-3xl p-8 shadow-2xl text-left space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 bg-gold-500/10 border border-[#A27B41]/35 rounded-2xl flex items-center justify-center text-[#A27B41]">
            <Package className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-display font-bold text-white">Setup Checklist</h2>
          <p className="text-xs text-slate-400">Confirm your environment for {exerciseName}</p>
        </div>

        <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Camera Guidance</span>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">{cameraAngle.replace(/_/g, ' ')}</Badge>
            <Badge variant="neutral">{stance}</Badge>
          </div>
        </div>

        {requirements.length > 0 && (
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Equipment & Setup</span>
            {requirements.map((req) => (
              <label
                key={req.slug}
                className="flex items-start gap-3 p-3 bg-slate-900/60 border border-slate-800 rounded-xl cursor-pointer hover:border-gold-500/30 transition-all"
              >
                <input
                  type="checkbox"
                  checked={selected.has(req.slug)}
                  onChange={() => toggle(req.slug)}
                  className="mt-1 accent-gold-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{req.name}</span>
                    {req.required && <Badge variant="warning">Required</Badge>}
                    {req.affects_tracking && <Badge variant="info">Affects tracking</Badge>}
                  </div>
                  {req.setup_instructions && (
                    <p className="text-[10px] text-slate-400 mt-1">{req.setup_instructions}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Environment Factors</span>
          <label className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer">
            <input type="checkbox" checked={mirrorPresent} onChange={() => setMirrorPresent(!mirrorPresent)} className="accent-gold-500" />
            <Eye className="h-4 w-4 text-slate-500" /> Mirror in view
          </label>
          <label className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer">
            <input type="checkbox" checked={othersPresent} onChange={() => setOthersPresent(!othersPresent)} className="accent-gold-500" />
            <Users className="h-4 w-4 text-slate-500" /> Others in the space
          </label>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><Volume2 className="h-3.5 w-3.5" /> Noise level</span>
              <span>{noiseLevel}/10</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              value={noiseLevel}
              onChange={(e) => setNoiseLevel(parseInt(e.target.value, 10))}
              className="w-full accent-gold-500"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onBack}>Back</Button>
          <Button variant="primary" className="flex-1" onClick={handleContinue}>Continue</Button>
        </div>
      </div>
    </div>
  );
};
