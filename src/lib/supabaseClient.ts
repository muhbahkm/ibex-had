/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string, fallback: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      return (import.meta as any).env[key] || fallback;
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key] || fallback;
    }
  } catch {}
  return fallback;
};

export const SUPABASE_URL = getEnv('VITE_SUPABASE_URL', 'https://lllgqnmrzaycmpypsifo.supabase.co');
export const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsbGdxbm1yemF5Y21weXBzaWZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NzI1MDksImV4cCI6MjA5NzU0ODUwOX0.XHlz6m-GN7UcccleHwzyBP9UDYq0DQfn5_g-0Rj6DhU');
export const BUSINESS_ID = getEnv('VITE_IBEX_BUSINESS_ID', '4c424fea-a5fb-485f-b695-535eac647224');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
