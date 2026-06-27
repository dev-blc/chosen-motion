import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, AlertCircle, BarChart3, ShieldAlert, GitCompare } from 'lucide-react';
import {
  fetchSessionDetail,
  fetchSessionFrames,
  fetchSessionAccuracy,
  fetchSessionComparison,
  fetchMySessions,
  fetchPatientDetail
} from '@/services/api';
import { SkeletonReplay } from './SkeletonReplay';
import { MetricsPanel } from './MetricsPanel';
import { ErrorList } from './ErrorList';
import { SessionComparison } from './SessionComparison';
import { SessionAnalytics } from './SessionAnalytics';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Status';

export const SessionReplayPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // States for API data
  const [session, setSession] = useState<any>(null);
  const [frames, setFrames] = useState<any[]>([]);
  const [accuracy, setAccuracy] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [comparisonMode, setComparisonMode] = useState<'previous' | 'best' | 'worst'>('previous');
  const [history, setHistory] = useState<any[]>([]);

  // Tab State: 'alerts' | 'analytics' | 'compare'
  const [activeTab, setActiveTab] = useState<'alerts' | 'analytics' | 'compare'>('alerts');

  useEffect(() => {
    const loadSessionData = async () => {
      if (!sessionId) return;
      setLoading(true);
      setError(null);

      try {
        const id = parseInt(sessionId);
        
        // 1. Fetch main session detail
        const sessionDetail = await fetchSessionDetail(id);
        setSession(sessionDetail);

        // 2. Fetch coordinate frames
        const frameData = await fetchSessionFrames(id);
        setFrames(frameData.frames || []);

        // 3. Fetch accuracy & error data
        const accuracyData = await fetchSessionAccuracy(id);
        setAccuracy(accuracyData);

        // 4. Fetch comparison metrics
        const comparisonData = await fetchSessionComparison(id, 'previous');
        setComparison(comparisonData);

        // 5. Fetch history (exercise progress trends)
        try {
          if (profile?.role === 'patient') {
            const mySessions = await fetchMySessions();
            const filtered = mySessions.filter((s: any) => s.exercise_id === sessionDetail.exercise_id);
            setHistory(filtered);
          } else if (profile?.role === 'admin') {
            const patientDetail = await fetchPatientDetail(sessionDetail.patient_id);
            const filtered = (patientDetail.sessions || []).filter((s: any) => s.exercise_id === sessionDetail.exercise_id);
            setHistory(filtered);
          }
        } catch (histErr) {
          console.warn('Failed to load session history trends:', histErr);
        }

      } catch (err: any) {
        console.error('Failed to load session replay data:', err);
        setError(err.message || 'Failed to retrieve session details from server.');
      } finally {
        setLoading(false);
      }
    };

    loadSessionData();
  }, [sessionId, profile]);

  const handleComparisonModeChange = async (mode: 'previous' | 'best' | 'worst') => {
    if (!sessionId) return;
    setComparisonMode(mode);
    try {
      const data = await fetchSessionComparison(parseInt(sessionId), mode);
      setComparison(data);
    } catch (err) {
      console.warn('Failed to load comparison mode', err);
    }
  };

  const handleBack = () => {
    if (profile?.role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/patient');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-chosen-bg text-chosen-text-primary">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <span className="text-sm font-semibold uppercase tracking-wider text-chosen-text-muted">Loading Telemetry Replay...</span>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-chosen-bg p-6 text-chosen-text-primary">
        <div className="max-w-md w-full p-6 bg-chosen-raised border border-chosen rounded-chosen-lg flex flex-col items-center gap-4 text-center shadow-chosen-lg">
          <AlertCircle className="h-12 w-12 text-error" />
          <h3 className="text-lg font-bold">Error Loading Session</h3>
          <p className="text-sm text-chosen-text-muted">{error || 'Session details could not be found.'}</p>
          <Button
            onClick={handleBack}
            variant="secondary"
            leftIcon={<ArrowLeft className="h-4 w-4" />}
            className="mt-2"
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-chosen-bg text-chosen-text-primary p-4 md:p-6 lg:p-8 flex flex-col gap-6">
      
      {/* Top Navigation / Breadcrumb */}
      <div className="flex items-center justify-between border-b border-chosen pb-5">
        <div className="flex items-center gap-4 text-left">
          <Button
            onClick={handleBack}
            variant="outline"
            size="sm"
            title="Back to Dashboard"
            leftIcon={<ArrowLeft className="h-5 w-5" />}
          />
          
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-bold text-chosen-text-muted uppercase tracking-widest">Skeletal Assessment</span>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-extrabold tracking-tight text-chosen-text-primary">{session.title || 'Motion Session'}</h2>
              <span className="text-xs font-mono px-2 py-0.5 bg-chosen-surface border border-chosen text-chosen-text-muted rounded-chosen-sm">
                ID: {session.id}
              </span>
            </div>
          </div>
        </div>

        {profile?.role === 'admin' && (
          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="text-xs font-semibold text-chosen-text-muted uppercase tracking-wider">Patient Profile</span>
            <span className="text-sm font-bold text-gold-550">{session.patient_id}</span>
          </div>
        )}
      </div>

      {/* Full Width Metrics Deck */}
      <MetricsPanel
        metrics={session.metrics_summary || {}}
        durationSeconds={session.duration_seconds}
        score={Math.round(session.score || 0)}
        status={session.status}
        errorCount={accuracy?.detected_errors?.length || 0}
      />

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:items-stretch">
        
        {/* Left: Replay Canvas viewport (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <SkeletonReplay 
            frames={frames} 
            exerciseName={session.title ? session.title.split(" - ")[0] : "Exercise"} 
          />
        </div>

        {/* Right: Tabbed Detail Controls HUD (5 cols) */}
        <div className="lg:col-span-5 flex flex-col min-h-[520px] lg:min-h-0 lg:h-full w-full">
          <div className="flex flex-col flex-1 min-h-0 bg-chosen-raised border border-chosen rounded-chosen-lg overflow-hidden">
            {/* Tab selectors */}
            <div className="flex-shrink-0 flex p-1.5 m-3 mb-0 bg-chosen-surface border border-chosen rounded-chosen-md gap-1">
              <button
                onClick={() => setActiveTab('alerts')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-chosen-sm transition-all ${
                  activeTab === 'alerts'
                    ? 'bg-gold-500/10 text-gold-500 border border-gold-500/20 shadow-chosen-sm'
                    : 'text-chosen-text-secondary hover:text-chosen-text-primary'
                }`}
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Form Alerts</span>
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-chosen-sm transition-all ${
                  activeTab === 'analytics'
                    ? 'bg-gold-500/10 text-gold-500 border border-gold-500/20 shadow-chosen-sm'
                    : 'text-chosen-text-secondary hover:text-chosen-text-primary'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Waveform & Trends</span>
                <span className="sm:hidden">Trends</span>
              </button>
              <button
                onClick={() => setActiveTab('compare')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-chosen-sm transition-all ${
                  activeTab === 'compare'
                    ? 'bg-gold-500/10 text-gold-500 border border-gold-500/20 shadow-chosen-sm'
                    : 'text-chosen-text-secondary hover:text-chosen-text-primary'
                }`}
              >
                <GitCompare className="h-4 w-4" />
                <span>Comparison</span>
              </button>
            </div>

            {/* Tab content — unified scroll container prevents clipping glitches */}
            <div className="flex-1 min-h-0 panel-scroll p-4 pt-3">
              {activeTab === 'alerts' && (
                <ErrorList errors={accuracy?.detected_errors || []} />
              )}

              {activeTab === 'analytics' && (
                <SessionAnalytics 
                  frames={frames} 
                  history={history} 
                  exerciseName={session.title ? session.title.split(" - ")[0] : "Exercise"}
                  errorCount={accuracy?.detected_errors?.length || 0}
                />
              )}

              {activeTab === 'compare' && comparison && (
                <SessionComparison
                  comparison={{ ...comparison, mode: comparisonMode }}
                  onModeChange={handleComparisonModeChange}
                />
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
