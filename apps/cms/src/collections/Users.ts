import type { CollectionConfig } from 'payload'
import { ROLE_OPTIONS } from '@blrhikes/shared'

const isProduction = process.env.NODE_ENV === 'production'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: {
    useAPIKey: true,
    cookies: {
      domain: isProduction ? '.blrhikes.com' : undefined,
      sameSite: 'Lax',
      secure: isProduction,
    },
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation === 'create') {
          const { totalDocs } = await req.payload.count({ collection: 'users' })
          if (totalDocs === 0) {
            data.role = 'admin'
          }
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      options: ROLE_OPTIONS.map((r) => ({ label: r, value: r })),
      defaultValue: 'lifetime',
      required: true,
      access: {
        update: ({ req }) => req.user?.role === 'admin',
      },
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'firstName',
      type: 'text',
    },
    {
      name: 'membershipExpiresAt',
      type: 'date',
      admin: {
        description: 'Only applies to yearly members. Null = no expiry.',
        condition: (data) => data?.role === 'yearly',
      },
    },
    {
      name: 'trailPurchases',
      type: 'relationship',
      relationTo: 'trails',
      hasMany: true,
      admin: {
        description: 'Trails this user bought individually (without membership)',
      },
    },
    {
      name: 'paymentSource',
      type: 'text',
      admin: {
        description: 'razorpay or manual',
        position: 'sidebar',
      },
    },
  ],
}
