import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { apiClient } from '@/api/apiClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const applySession = useCallback(async (session) => {
    if (!session) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles').select('full_name, role').eq('id', session.user.id).single();

    setUser({
      id: session.user.id,
      email: session.user.email,
      full_name: profile?.full_name || session.user.user_metadata?.full_name || '',
      role: profile?.role || 'user',
    });
    setIsAuthenticated(true);
    setIsLoadingAuth(false);

    apiClient.functions.invoke('syncUserLogin', {}).catch((err) => {
      console.warn('Failed to sync user login:', err.message);
    });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => applySession(data.session));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => subscription.subscription.unsubscribe();
  }, [applySession]);

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoadingAuth, signIn, signUp, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
