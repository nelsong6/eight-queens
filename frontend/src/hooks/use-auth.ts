import { useState, useEffect, useCallback, useRef } from 'react';
import { setAuthToken } from '../api/client';

interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  credential: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, config: Record<string, unknown>) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

export function useAuth() {
  const [user, setUser] = useState<GoogleUser | null>(() => {
    const stored = localStorage.getItem('eq_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as GoogleUser;
        setAuthToken(parsed.credential);
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  });

  const gsiLoaded = useRef(false);

  const handleCredentialResponse = useCallback((response: { credential: string }) => {
    const payload = JSON.parse(atob(response.credential.split('.')[1]!));
    const googleUser: GoogleUser = {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      credential: response.credential,
    };
    setUser(googleUser);
    setAuthToken(response.credential);
    localStorage.setItem('eq_user', JSON.stringify(googleUser));
  }, []);

  useEffect(() => {
    if (gsiLoaded.current) return;
    const interval = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(interval);
        gsiLoaded.current = true;
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
          callback: handleCredentialResponse,
        });
      }
    }, 100);
    return () => clearInterval(interval);
  }, [handleCredentialResponse]);

  const renderGoogleButton = useCallback((element: HTMLElement | null) => {
    if (!element || !window.google?.accounts?.id) return;
    window.google.accounts.id.renderButton(element, {
      theme: 'outline',
      size: 'medium',
      type: 'standard',
    });
  }, []);

  const signIn = useCallback(() => {
    // Button click is handled by Google's rendered button
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    setAuthToken(null);
    localStorage.removeItem('eq_user');
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  }, []);

  return { user, signIn, signOut, renderGoogleButton };
}
