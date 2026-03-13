import type { CollectionConfig } from 'payload'

export const GpxFiles: CollectionConfig = {
  slug: 'gpx-files',
  admin: {
    useAsTitle: 'filename',
  },
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  fields: [],
  upload: {
    crop: false,
    focalPoint: false,
    mimeTypes: ['application/gpx+xml', 'application/xml', 'text/xml', 'application/octet-stream'],
  },
}
