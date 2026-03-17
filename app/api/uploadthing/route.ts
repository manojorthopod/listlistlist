import { createRouteHandler } from 'uploadthing/next'
import { ourFileRouter } from '@/lib/uploadthing'

// Explicitly pass the token so the dependency is visible and easy to debug.
// The SDK also reads UPLOADTHING_TOKEN from the environment automatically,
// but being explicit here surfaces a missing token as a startup error rather
// than a confusing upload failure at runtime.
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
  config: {
    token: process.env.UPLOADTHING_TOKEN,
  },
})
