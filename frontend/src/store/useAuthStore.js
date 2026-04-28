import { create } from 'zustand';
import axios from 'axios';

const API_URL = `${(import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '')}/public`;

const useAuthStore = create((set) => ({
  certificate: null,
  loading: false,
  error: null,

  verifyCertificate: async (id, opts = {}) => {
    set({ loading: true, error: null });
    try {
      const lang = opts?.lang ? String(opts.lang) : null;
      const response = await axios.get(`${API_URL}/cert/${id}`, {
        params: lang ? { lang } : undefined
      });
      set({ certificate: response.data.data, loading: false });
    } catch (err) {
      set({ 
        error: err.response?.data?.message || 'Verification failed', 
        loading: false,
        certificate: null 
      });
    }
  },
}));

export default useAuthStore;
