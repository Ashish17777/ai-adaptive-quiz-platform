import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add auth token to requests
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor to handle 401 Unauthorized responses (e.g. stale tokens when DB restarts)
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Redirect to login if user is on a protected route
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }

    // Intercept AI service down/failure and trigger the system-wide popup
    const url = error.config?.url || '';
    const message = error.response?.data?.message || error.message || '';
    const isAiEndpoint = url.includes('/ai/') || url.includes('/generate-');
    const isAiDownMessage =
      typeof message === 'string' &&
      (message.includes('AI Service Unavailable') ||
        message.includes('temporarily down') ||
        message.includes('AI service is not configured') ||
        message.includes('Gemini Error'));

    if (
      isAiDownMessage ||
      (isAiEndpoint && (
        error.response?.status === 500 || 
        error.response?.status === 503 ||
        error.code === 'ERR_NETWORK' ||
        error.message === 'Network Error'
      ))
    ) {
      const displayMessage = isAiDownMessage
        ? message
        : 'The AI service is temporarily unreachable. Please check your connection or try again in a few moments.';

      window.dispatchEvent(
        new CustomEvent('ai-service-down', {
          detail: { message: displayMessage, endpoint: url },
        })
      );
    }

    return Promise.reject(error);
  }
);

export default API;
