import React from 'react';
import { SignInButton, useProfile } from '@farcaster/auth-kit';

interface LoginButtonProps {
  onLoginSuccess?: (userData: any) => void;
  onLoginError?: (error: string) => void;
}

export const LoginButton: React.FC<LoginButtonProps> = ({ onLoginSuccess, onLoginError }) => {
  const { isAuthenticated, profile } = useProfile();

  if (isAuthenticated && profile) {
    return (
      <div className="login-container">
        <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
          {profile.pfpUrl && (
            <img
              src={profile.pfpUrl}
              alt="Profile"
              style={{ width: 60, height: 60, borderRadius: '50%', marginBottom: '0.5rem' }}
            />
          )}
          <p style={{ margin: '0.5rem 0', fontWeight: 'bold' }}>
            {profile.displayName || profile.username}
          </p>
          <p style={{ margin: '0.25rem 0', color: '#666', fontSize: '0.9rem' }}>
            @{profile.username}
          </p>
          <p style={{ margin: '0.25rem 0', color: '#666', fontSize: '0.85rem' }}>
            FID: {profile.fid}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <SignInButton
        onSuccess={(res) => onLoginSuccess?.(res)}
        onError={(err) => onLoginError?.(err?.message || 'Login failed')}
      />
    </div>
  );
};

export default LoginButton;
