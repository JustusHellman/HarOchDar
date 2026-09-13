
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Use relative base path so built assets load correctly on any GitHub repository name, custom domain, or subfolder
  base: './',
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
  define: {
    // We explicitly define the necessary environment variables.
    // Falls back to the project's default Supabase instance so live preview and login work seamlessly.
    'process.env.HERE_AND_THERE_SUPABASE_URL': JSON.stringify(
      process.env.HERE_AND_THERE_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      'https://hdxpdmksegdmiwzxorbq.supabase.co'
    ),
    'process.env.HERE_AND_THERE_SUPABASE_ANON_KEY': JSON.stringify(
      process.env.HERE_AND_THERE_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      'sb_publishable_m6ZMa5Nuv_xti6VJ9fNphA_0OoAG_Qp'
    ),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
