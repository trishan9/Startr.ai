import { createAuthRouteHandlers } from '@insforge/nextjs/api';

const handlers = createAuthRouteHandlers({
  baseUrl: process.env.INSFORGE_BASE_URL || 'https://gc3264pz.us-east.insforge.app'
});

export const POST = handlers.POST;
export const GET = handlers.GET;
export const DELETE = handlers.DELETE;
