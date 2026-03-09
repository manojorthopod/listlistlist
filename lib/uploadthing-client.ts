/**
 * Client-side UploadThing helpers — type-safe, generated from OurFileRouter.
 * Import from this file in Client Components; never import from 'uploadthing/next'
 * directly in browser code.
 */
import { generateReactHelpers } from '@uploadthing/react'
import type { OurFileRouter } from './uploadthing'

export const { useUploadThing, uploadFiles } = generateReactHelpers<OurFileRouter>()
