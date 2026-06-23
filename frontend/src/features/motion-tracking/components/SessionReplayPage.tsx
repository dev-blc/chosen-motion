import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Loader2, AlertCircle, BarChart3, ShieldAlert, GitCompare } from 'lucide-react';
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
        const comparisonData = await fetchSessionComparison(id);
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

  const handleBack = () => {
    if (profile?.role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/patient');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-cyan-400 animate-spin" />
          <span className="text-sm font-semibold uppercase tracking-wider text-slate-400">Loading Telemetry Replay...</span>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 text-white">
        <div className="max-w-md w-full p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-rose-500" />
          <h3 className="text-lg font-bold">Error Loading Session</h3>
          <p className="text-sm text-slate-400">{error || 'Session details could not be found.'}</p>
          <button
            onClick={handleBack}
            className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all border border-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-6 lg:p-8 flex flex-col gap-6">
      
      {/* Top Navigation / Breadcrumb */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-5">
        <div className="flex items-center gap-4 text-left">
          <button
            onClick={handleBack}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 transition-all text-slate-400 hover:text-white"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Skeletal Assessment</span>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-extrabold tracking-tight">{session.title || 'Motion Session'}</h2>
              <span className="text-xs font-mono px-2 py-0.5 bg-slate-900 border border-slate-800 text-slate-400 rounded-md">
                ID: {session.id}
              </span>
            </div>
          </div>
        </div>

        {profile?.role === 'admin' && (
          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Patient Profile</span>
            <span className="text-sm font-bold text-cyan-400">{session.patient_id}</span>
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
          <div className="flex flex-col flex-1 min-h-0 bg-slate-900/40 border border-slate-850 rounded-2xl overflow-hidden">
            {/* Tab selectors */}
            <div className="flex-shrink-0 flex p-1.5 m-3 mb-0 bg-slate-950 border border-slate-850 rounded-xl gap-1">
              <button
                onClick={() => setActiveTab('alerts')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'alerts'
                    ? 'bg-slate-800 text-cyan-400 border border-slate-750 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Form Alerts</span>
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'analytics'
                    ? 'bg-slate-800 text-cyan-400 border border-slate-750 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Waveform & Trends</span>
                <span className="sm:hidden">Trends</span>
              </button>
              <button
                onClick={() => setActiveTab('compare')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'compare'
                    ? 'bg-slate-800 text-cyan-400 border border-slate-750 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
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
                <SessionComparison comparison={comparison} />
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
