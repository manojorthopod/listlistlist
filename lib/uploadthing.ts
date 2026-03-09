import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { auth } from '@clerk/nextjs/server'

const f = createUploadthing()

/**
 * UploadThing file router.
 *
 * productImage — the single upload route used throughout the app.
 * Max 5 MB, accepts jpg / png / webp only.
 * Requires auth: unauthenticated uploads are rejected at the server.
 */
export const ourFileRouter = {
  productImage: f({
    image: {
      maxFileSize: '4MB',
      maxFileCount: 1,
      // Restrict to the three formats our vision model handles well
      contentDisposition: 'inline',
    },
  })
    .middleware(async () => {
      const { userId } = await auth()
      if (!userId) throw new Error('Unauthorised')
      // Metadata is passed to onUploadComplete
      return { userId }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Return data accessible client-side after upload resolves
      return { uploadedBy: metadata.userId, url: file.ufsUrl }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
