import type { CollectionConfig, FieldAccess } from 'payload'

import { DIFFICULTY_OPTIONS, ACCESS_OPTIONS } from '@blrhikes/shared'

/**
 * Field-level read access for gated fields.
 * Allows access if user:
 * - is admin or contributor (always)
 * - is lifetime member
 * - is yearly member with valid (non-expired) membership
 * - has purchased this specific trail
 */
const canReadGatedField: FieldAccess = ({ req, doc }) => {
  const user = req.user
  if (!user) return false

  const role = user.role as string

  // Admins and contributors always have access
  if (role === 'admin' || role === 'contributor') return true

  // Lifetime members always have access
  if (role === 'lifetime') return true

  // Yearly members: check expiry
  if (role === 'yearly') {
    const expiresAt = user.membershipExpiresAt as string | undefined
    if (!expiresAt) return false
    return new Date(expiresAt) > new Date()
  }

  // Check individual trail purchase
  if (doc?.id && Array.isArray(user.trailPurchases)) {
    return user.trailPurchases.some(
      (t: any) => (typeof t === 'object' ? t.id : t) === doc.id,
    )
  }

  return false
}

export const Trails: CollectionConfig = {
  slug: 'trails',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'area', 'difficulty', 'status'],
  },
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  fields: [
    // Core
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'githubIssueNumber',
      type: 'number',
      unique: true,
      admin: {
        position: 'sidebar',
        description: 'GitHub issue number from blrhikes-data',
      },
    },
    {
      name: 'altName',
      type: 'text',
    },

    // Media
    {
      name: 'coverImage',
      type: 'group',
      admin: {
        description: 'Cover image — use a CDN URL or upload/select an image',
      },
      fields: [
        {
          name: 'type',
          type: 'radio',
          defaultValue: 'url',
          options: [
            { label: 'CDN URL', value: 'url' },
            { label: 'Upload', value: 'upload' },
          ],
        },
        {
          name: 'url',
          type: 'text',
          admin: {
            condition: (_, siblingData) => siblingData?.type === 'url',
            description: 'External CDN URL for the cover image',
          },
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          admin: {
            condition: (_, siblingData) => siblingData?.type === 'upload',
            description: 'Upload or select an existing image',
          },
        },
      ],
    },
    {
      name: 'photos',
      type: 'array',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
    },

    // Location
    {
      name: 'area',
      type: 'relationship',
      relationTo: 'areas',
      admin: {
        position: 'sidebar',
        allowCreate: true,
      },
    },
    {
      name: 'gps',
      type: 'text',
      access: {
        read: canReadGatedField,
      },
    },
    {
      name: 'relativeLocation',
      type: 'text',
    },
    {
      name: 'isLocal',
      type: 'checkbox',
      defaultValue: false,
    },

    // Characteristics
    {
      name: 'highlights',
      type: 'relationship',
      relationTo: 'highlights',
      hasMany: true,
      admin: {
        allowCreate: true,
      },
    },
    {
      name: 'rating',
      type: 'number',
      min: 0,
      max: 5,
    },
    {
      name: 'length',
      type: 'number',
      admin: {
        description: 'Trail length in km',
      },
    },
    {
      name: 'elevationGain',
      type: 'number',
      admin: {
        description: 'Elevation gain in meters',
      },
    },
    {
      name: 'elevation',
      type: 'number',
      admin: {
        description: 'Peak elevation in meters',
      },
    },
    {
      name: 'difficulty',
      type: 'select',
      options: DIFFICULTY_OPTIONS.map((d) => ({ label: d, value: d })),
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'access',
      type: 'select',
      options: ACCESS_OPTIONS.map((a) => ({ label: a, value: a })),
    },

    // Driving
    {
      name: 'drivingDistance',
      type: 'number',
      admin: {
        description: 'Driving distance in km',
      },
    },
    {
      name: 'drivingDistanceText',
      type: 'text',
    },
    {
      name: 'drivingTime',
      type: 'number',
      admin: {
        description: 'Driving time in minutes',
      },
    },
    {
      name: 'drivingTimeText',
      type: 'text',
    },

    // Hiking
    {
      name: 'hikingTime',
      type: 'number',
      admin: {
        description: 'Hiking time in minutes',
      },
    },
    {
      name: 'hikingTimeWithRests',
      type: 'number',
      admin: {
        description: 'Hiking time with rests in minutes',
      },
    },
    {
      name: 'hikingTimeWithExploration',
      type: 'number',
      admin: {
        description: 'Hiking time with exploration in minutes',
      },
    },

    // Gated — only visible to authenticated users
    {
      name: 'mapLink',
      type: 'text',
      access: {
        read: canReadGatedField,
      },
      admin: {
        description: 'Hidden from free users in frontend',
      },
    },
    {
      name: 'gpxFile',
      type: 'upload',
      relationTo: 'gpx-files',
      access: {
        read: canReadGatedField,
      },
      admin: {
        description: 'GPX track file for this trail',
      },
    },

    // Content - plain markdown, NOT Lexical rich text
    {
      name: 'content',
      type: 'textarea',
      admin: {
        description: 'Trail description in markdown',
      },
    },

    // Status
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Live', value: 'live' },
      ],
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
