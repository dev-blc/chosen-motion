import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { syncUserWithBackend, fetchUserProfile, fetchPatientProfile } from '@/services/api';

export interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'patient';
  firstName?: string;
  lastName?: string;
  patientId?: string;
  gender?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  role: 'admin' | 'patient' | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signInMock: (role: 'admin' | 'patient', email: string, firstName?: string, lastName?: string) => Promise<void>;
  isMock: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMock, setIsMock] = useState(false);

  const loadProfile = async (sessionUser: User) => {
    try {
      const data = await fetchUserProfile();
      let patientId: string | undefined;
      let gender: string | undefined;

      if (data.role === 'patient') {
        try {
          const patientData = await fetchPatientProfile();
          patientId = patientData.patient_id;
          gender = patientData.gender;
        } catch (patientErr) {
          console.warn('Failed to load patient sub-profile, self-healing via sync...', patientErr);
          try {
            const userMetadata = sessionUser.user_metadata || {};
            await syncUserWithBackend({
              id: sessionUser.id,
              email: sessionUser.email || '',
              role: userMetadata.role || 'patient',
              first_name: userMetadata.first_name || '',
              last_name: userMetadata.last_name || '',
            });
            const patientData = await fetchPatientProfile();
            patientId = patientData.patient_id;
            gender = patientData.gender;
          } catch (syncErr) {
            console.error('Failed to self-heal patient profile:', syncErr);
          }
        }
      }

      setProfile({
        id: data.id,
        email: data.email,
        role: data.role as 'admin' | 'patient',
        firstName: data.first_name,
        lastName: data.last_name,
        patientId,
        gender,
      });
    } catch (err) {
      console.warn('Failed to load profile from backend, syncing metadata...', err);
      try {
        const userMetadata = sessionUser.user_metadata || {};
        const synced = await syncUserWithBackend({
          id: sessionUser.id,
          email: sessionUser.email || '',
          role: userMetadata.role || 'patient',
          first_name: userMetadata.first_name || '',
          last_name: userMetadata.last_name || '',
        });

        let patientId: string | undefined;
        let gender: string | undefined;

        if (synced.role === 'patient') {
          try {
            const patientData = await fetchPatientProfile();
            patientId = patientData.patient_id;
            gender = patientData.gender;
          } catch (pErr) {
            console.warn('Failed to fetch patient sub-profile after sync:', pErr);
          }
        }

        setProfile({
          id: synced.id,
          email: synced.email,
          role: synced.role as 'admin' | 'patient',
          firstName: synced.first_name,
          lastName: synced.last_name,
          patientId,
          gender,
        });
      } catch (syncErr) {
        console.error('Failed to sync profile with backend', syncErr);
        setProfile({
          id: sessionUser.id,
          email: sessionUser.email || '',
          role: (sessionUser.user_metadata?.role as 'admin' | 'patient') || 'patient',
          firstName: sessionUser.user_metadata?.first_name,
          lastName: sessionUser.user_metadata?.last_name,
        });
      }
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user);
    }
  };

  const signInMock = async (
    role: 'admin' | 'patient',
    email: string,
    firstName?: string,
    lastName?: string
  ) => {
    setLoading(true);
    const mockId = role === 'admin'
      ? '00000000-0000-0000-0000-000000000002'
      : '00000000-0000-0000-0000-000000000001';
    const mockUser = {
      id: mockId,
      email,
      user_metadata: { first_name: firstName, last_name: lastName, role },
    } as unknown as User;

    localStorage.setItem('chosen_motion_mock_user', JSON.stringify(mockUser));

    // Sync the mock user with the backend database so their profile and patient/admin record exist!
    try {
      await syncUserWithBackend({
        id: mockId,
        email: email,
        role: role,
        first_name: firstName,
        last_name: lastName,
      });
    } catch (err) {
      console.warn('Failed to sync mock user with backend:', err);
    }

    setUser(mockUser);

    // Load the profile from backend so we get the generated patientId/adminId
    await loadProfile(mockUser).catch((err) => {
      console.warn('Failed to load profile for mock user:', err);
      setProfile({
        id: mockUser.id,
        email: mockUser.email || email,
        role,
        firstName,
        lastName,
      });
    });

    setIsMock(true);
    setLoading(false);
  };

  useEffect(() => {
    // Check if we have a mock user in localStorage
    const savedMockUser = localStorage.getItem('chosen_motion_mock_user');
    if (savedMockUser) {
      try {
        const parsedUser = JSON.parse(savedMockUser) as User;
        
        // Self-heal: clear non-static legacy mock IDs to switch to static ones
        const isLegacyMock = parsedUser.id && !parsedUser.id.endsWith('-demo') && 
          parsedUser.id !== '00000000-0000-0000-0000-000000000001' && 
          parsedUser.id !== '00000000-0000-0000-0000-000000000002';
        if (isLegacyMock) {
          localStorage.removeItem('chosen_motion_mock_user');
        } else {
          setUser(parsedUser);
          setProfile({
            id: parsedUser.id,
            email: parsedUser.email || '',
            role: parsedUser.user_metadata?.role || 'patient',
            firstName: parsedUser.user_metadata?.first_name,
            lastName: parsedUser.user_metadata?.last_name,
          });
          setIsMock(true);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Failed to parse saved mock user, clearing...', err);
        localStorage.removeItem('chosen_motion_mock_user');
      }
    }

    if (!isSupabaseConfigured) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    // Check active Supabase sessions
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadProfile(session.user).finally(() => setLoading(false));
      } else {
        setProfile(null);
        setLoading(false);
      }
    }).catch(() => {
      // Supabase failed to initialize (e.g. invalid URL)
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        setLoading(true);
        loadProfile(session.user).finally(() => setLoading(false));
      } else if (!localStorage.getItem('chosen_motion_mock_user')) {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    setLoading(true);
    if (isMock) {
      localStorage.removeItem('chosen_motion_mock_user');
      setIsMock(false);
    } else {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase signout failed', err);
      }
    }
    // Clear all storage to prevent any stale cache or tokens
    localStorage.clear();
    sessionStorage.clear();

    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  const value = {
    user,
    profile,
    loading,
    role: profile?.role || null,
    signOut,
    refreshProfile,
    signInMock,
    isMock,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
