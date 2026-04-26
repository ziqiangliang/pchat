import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import './LoginModal.css';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  const { login, register, isLoading } = useAuthStore();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let success: boolean;
    if (isRegister) {
      success = await register(email, password, nickname || undefined);
    } else {
      success = await login(email, password);
    }

    if (success) {
      onClose();
    } else {
      setError(useAuthStore.getState().error || 'Operation failed');
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setError('');
  };

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <div className="login-modal-header">
          <h2>{isRegister ? t('auth.register') : t('auth.login')}</h2>
          <button className="login-modal-close" onClick={onClose}>×</button>
        </div>

        <form className="login-modal-form" onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label>{t('auth.nickname')}</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={t('auth.nicknamePlaceholder')}
              />
            </div>
          )}

          <div className="form-group">
            <label>{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              required
            />
          </div>

          <div className="form-group">
            <label>{t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
              required
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? t('auth.loading') : (isRegister ? t('auth.register') : t('auth.login'))}
          </button>

          <div className="login-modal-footer">
            <button type="button" onClick={toggleMode} className="btn btn-link">
              {isRegister ? t('auth.hasAccount') : t('auth.noAccount')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
