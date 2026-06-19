import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Activity, Lock, Mail, AlertCircle, Loader2, User, Shield } from 'lucide-react';

const Login: React.FC = () => {
  const { signInMock } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authErr) {
      setError(authErr.message || 'Authentication error. Use Sandbox Mode below.');
      setLoading(false);
    } else {
      navigate('/');
    }
  };

  const handleSandboxLogin = (role: 'admin' | 'patient') => {
    if (role === 'admin') {
      signInMock('admin', 'demo.clinician@chosenmotion.com', 'Marcus', 'Aurelius');
    } else {
      signInMock('patient', 'demo.patient@chosenmotion.com', 'Sarah', 'Connor');
    }
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-light via-slate-100 to-indigo-50 dark:from-brand-dark dark:via-slate-950 dark:to-indigo-950 px-4">
      <div className="w-full max-w-md glass-card p-8 animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 bg-primary-500 rounded-2xl flex items-center justify-center text-white mb-3 shadow-premium">
            <Activity className="h-6 w-6" />
          </div>
          <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-white">Chosen Motion</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sign in to your patient or clinician account</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
              <input
                type="email"
                required
                className="input-field pl-12"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
              <input
                type="password"
                required
                className="input-field pl-12"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary mt-2 py-3.5"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary-500 hover:text-primary-600 font-medium transition-colors">
            Create an Account
          </Link>
        </div>

        {/* Sandbox Dev Mode Bypass */}
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800/80">
          <div className="text-center text-[10px] font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase mb-4">
            Sandbox Sandbox / Demo Mode
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleSandboxLogin('patient')}
              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
            >
              <User className="h-3.5 w-3.5" />
              Demo Patient
            </button>
            <button
              onClick={() => handleSandboxLogin('admin')}
              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
            >
              <Shield className="h-3.5 w-3.5" />
              Demo Clinician
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;
