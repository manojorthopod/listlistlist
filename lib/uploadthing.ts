import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { UploadThingError } from 'uploadthing/server'
import { auth } from '@clerk/nextjs/server'

const f = createUploadthing()

/**
 * UploadThing file router (SDK v7+).
 *
 * productImage — the single upload route used throughout the app.
 * Max 4 MB, accepts jpg / png / webp only.
 * Requires auth: unauthenticated uploads are rejected at the server.
 */
export const ourFileRouter = {
  productImage: f({
    image: {
      maxFileSize: '4MB',
      maxFileCount: 1,
      contentDisposition: 'inline',
    },
  })
    // v7 middleware receives { req } — use UploadThingError for typed rejections
    .middleware(async () => {
      const { userId } = await auth()
      if (!userId) throw new UploadThingError('Unauthorised')
      return { userId }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // file.ufsUrl is the canonical CDN URL in SDK v7+
      return { uploadedBy: metadata.userId, url: file.ufsUrl }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
