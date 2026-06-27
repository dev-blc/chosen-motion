import React from 'react';
import { Package, Volume2, Users, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

interface EnvironmentContext {
  declared_components?: string[];
  noise_level?: number | null;
  mirror_present?: boolean | null;
  other_users_present?: boolean | null;
  environment_score?: number | null;
}

interface EnvironmentBannerProps {
  environment?: EnvironmentContext;
}

export const EnvironmentBanner: React.FC<EnvironmentBannerProps> = ({ environment }) => {
  if (!environment || Object.keys(environment).length === 0) {
    return null;
  }

  const components = environment.declared_components || [];
  const score = environment.environment_score;

  return (
    <div className="p-4 bg-chosen-surface border border-chosen rounded-chosen-lg text-left">
      <div className="flex items-center gap-2 mb-2">
        <Package className="h-4 w-4 text-gold-500" />
        <span className="text-xs font-bold uppercase tracking-wider text-chosen-text-muted">Session Environment</span>
        {score != null && (
          <Badge variant={score >= 70 ? 'success' : score >= 50 ? 'warning' : 'error'}>
            Score {score}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {components.map((slug) => (
          <Badge key={slug} variant="neutral">{slug.replace(/_/g, ' ')}</Badge>
        ))}
        {components.length === 0 && (
          <span className="text-xs text-chosen-text-muted">No equipment declared</span>
        )}
      </div>
      <div className="flex flex-wrap gap-4 text-2xs text-chosen-text-muted">
        {environment.noise_level != null && (
          <span className="flex items-center gap-1"><Volume2 className="h-3 w-3" /> Noise: {environment.noise_level}/10</span>
        )}
        {environment.mirror_present && (
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Mirror present</span>
        )}
        {environment.other_users_present && (
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Others present</span>
        )}
      </div>
    </div>
  );
};
