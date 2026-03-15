import { auth } from '@insforge/nextjs';
import { createClient } from '@insforge/sdk';


export async function getAuthServer() {
  const { token, user } = await auth()

  const insforge = createClient({
    baseUrl: process.env.INSFORGE_BASE_URL || 'https://gc3264pz.us-east.insforge.app',
    edgeFunctionToken: token || undefined
  });

  return { insforge, user }

}
