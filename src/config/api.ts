const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  auth: {
    login: `${API_BASE_URL}/api/auth/login`,
    register: `${API_BASE_URL}/api/auth/register`,
    me: `${API_BASE_URL}/api/auth/me`,
  },
  chat: `${API_BASE_URL}/api/chat`,
  tts: `${API_BASE_URL}/api/tts`,
  conversations: `${API_BASE_URL}/api/conversations`,
  usage: `${API_BASE_URL}/api/usage`,
};

export const getAuthHeaders = () => {
  const token = localStorage.getItem('pchat_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export { API_BASE_URL };
