import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { syncUserWithBackend, fetchUserProfile } from '@/services/api';

export interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'patient';
  firstName?: string;
  lastName?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  role: 'admin' | 'patient' | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signInMock: (role: 'admin' | 'patient', email: string, firstName?: string, lastName?: string) => void;
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
      setProfile({
        id: data.id,
        email: data.email,
        role: data.role as 'admin' | 'patient',
        firstName: data.first_name,
        lastName: data.last_name,
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
        setProfile({
          id: synced.id,
          email: synced.email,
          role: synced.role as 'admin' | 'patient',
          firstName: synced.first_name,
          lastName: synced.last_name,
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

  const signInMock = (
    role: 'admin' | 'patient',
    email: string,
    firstName?: string,
    lastName?: string
  ) => {
    setLoading(true);
    const mockUser = {
      id: `mock-uuid-${role}-${Date.now()}`,
      email,
      user_metadata: { first_name: firstName, last_name: lastName, role },
    } as unknown as User;

    localStorage.setItem('chosen_motion_mock_user', JSON.stringify(mockUser));
    setUser(mockUser);
    setProfile({
      id: mockUser.id,
      email: mockUser.email || email,
      role,
      firstName,
      lastName,
    });
    setIsMock(true);
    setLoading(false);
  };

  useEffect(() => {
    // Check if we have a mock user in localStorage
    const savedMockUser = localStorage.getItem('chosen_motion_mock_user');
    if (savedMockUser) {
      const parsedUser = JSON.parse(savedMockUser) as User;
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
