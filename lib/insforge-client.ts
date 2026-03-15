import { createClient } from '@insforge/sdk';

export const insforge = createClient({
  baseUrl: process.env.INSFORGE_BASE_URL || 'https://gc3264pz.us-east.insforge.app',
  anonKey: process.env.INSFORGE_ANON_KEY!
});
