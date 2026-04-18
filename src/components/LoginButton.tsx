import React, { useState } from 'react';

interface LoginButtonProps {
    onLoginSuccess?: (userData: any) => void;
    onLoginError?: (error: string) => void;
}

export const LoginButton: React.FC<LoginButtonProps> = ({ onLoginSuccess, onLoginError }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: 'initiate' }),
            });
            if (!response.ok) {
                throw new Error('Failed to initiate login');
            }
            const { authUrl } = await response.json();
            window.location.href = authUrl;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Login failed';
            setError(errorMessage);
            onLoginError?.(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <button onClick={handleLogin} disabled={loading} className="login-button">
                {loading ? 'Signing in...' : 'Login with Farcaster'}
            </button>
            {error && <p className="error-message">{error}</p>}
        </div>
    );
};

export default LoginButton;
