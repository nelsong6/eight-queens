import React, { useRef, useEffect } from 'react';

interface AuthUser {
  email: string;
  name: string;
  picture: string;
}

interface Props {
  user: AuthUser | null;
  onSignIn: () => void;
  onSignOut: () => void;
  renderGoogleButton: (element: HTMLElement | null) => void;
}

export const GoogleSignIn: React.FC<Props> = ({
  user,
  onSignOut,
  renderGoogleButton,
}) => {
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      renderGoogleButton(buttonRef.current);
    }
  }, [user, renderGoogleButton]);

  if (user) {
    return (
      <div style={styles.signedIn}>
        <img src={user.picture} alt="" style={styles.avatar} />
        <span style={styles.name}>{user.name}</span>
        <button onClick={onSignOut} style={styles.signOutBtn}>
          Sign Out
        </button>
      </div>
    );
  }

  return <div ref={buttonRef} style={styles.buttonContainer} />;
};

const styles: Record<string, React.CSSProperties> = {
  signedIn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
  },
  name: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#ccc',
  },
  signOutBtn: {
    padding: '4px 10px',
    fontSize: 11,
    fontFamily: 'monospace',
    backgroundColor: 'transparent',
    color: '#888',
    border: '1px solid #555',
    borderRadius: 3,
    cursor: 'pointer',
  },
  buttonContainer: {
    minHeight: 36,
  },
};
