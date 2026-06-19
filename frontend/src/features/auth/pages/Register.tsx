import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Activity, Lock, Mail, User, Shield, AlertCircle, Loader2 } from 'lucide-react';

const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<'patient' | 'admin'>('patient');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signUpErr, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          role: role,
        },
      },
    });

    if (signUpErr) {
      setError(signUpErr.message);
      setLoading(false);
    } else if (data?.user) {
      setSuccess(true);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-light via-slate-100 to-indigo-50 dark:from-brand-dark dark:via-slate-950 dark:to-indigo-950 px-4">
        <div className="w-full max-w-md glass-card p-8 text-center animate-fade-in">
          <div className="h-12 w-12 bg-accent-500 rounded-2xl flex items-center justify-center text-white mb-5 mx-auto shadow-premium">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-white mb-2">Registration Successful</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            We have sent a confirmation email. Please verify your email before logging in.
          </p>
          <Link to="/login" className="w-full btn-primary py-3.5">
            Proceed to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-light via-slate-100 to-indigo-50 dark:from-brand-dark dark:via-slate-950 dark:to-indigo-950 px-4 py-12">
      <div className="w-full max-w-md glass-card p-8 animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 bg-primary-500 rounded-2xl flex items-center justify-center text-white mb-3 shadow-premium">
            <Activity className="h-6 w-6" />
          </div>
          <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-white">Join Chosen Motion</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Create an account to begin tracking motion</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">First Name</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5">Last Name</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

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

          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">I am signing up as a...</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className={`py-3 px-4 rounded-xl border font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                  role === 'patient'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400 ring-2 ring-primary-500/20'
                    : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900'
                }`}
                onClick={() => setRole('patient')}
              >
                <User className="h-4 w-4" />
                Patient
              </button>
              <button
                type="button"
                className={`py-3 px-4 rounded-xl border font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                  role === 'admin'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400 ring-2 ring-primary-500/20'
                    : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900'
                }`}
                onClick={() => setRole('admin')}
              >
                <Shield className="h-4 w-4" />
                Clinician
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary mt-4 py-3.5"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Registering Account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-500 hover:text-primary-600 font-medium transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
