import type { CollectionConfig } from 'payload'

export const Payments: CollectionConfig = {
  slug: 'payments',
  admin: {
    useAsTitle: 'razorpayOrderId',
    defaultColumns: ['user', 'plan', 'amount', 'status', 'createdAt'],
  },
  access: {
    read: ({ req }) => !!req.user,
    create: () => false, // created only via webhook handler
    update: () => false,
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'plan',
      type: 'select',
      required: true,
      options: [
        { label: 'Lifetime', value: 'lifetime' },
        { label: 'Yearly', value: 'yearly' },
        { label: 'Trail (single)', value: 'trail' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'trail',
      type: 'relationship',
      relationTo: 'trails',
      admin: {
        description: 'Only set for single-trail purchases',
        condition: (data) => data?.plan === 'trail',
        position: 'sidebar',
      },
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      admin: {
        description: 'Amount in INR paise (e.g. 269900 = ₹2699)',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
        { label: 'Failed', value: 'failed' },
        { label: 'Refunded', value: 'refunded' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'razorpayOrderId',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Razorpay order_id',
      },
    },
    {
      name: 'razorpayPaymentId',
      type: 'text',
      admin: {
        description: 'Razorpay payment_id — set after successful payment',
      },
    },
    {
      name: 'razorpaySignature',
      type: 'text',
      admin: {
        description: 'HMAC-SHA256 signature verified on webhook receipt',
      },
    },
    {
      name: 'membershipExpiresAt',
      type: 'date',
      admin: {
        description: 'Set for yearly plans. One year from payment date.',
        condition: (data) => data?.plan === 'yearly',
      },
    },
    {
      name: 'notes',
      type: 'text',
      admin: {
        description: 'Admin notes or error details',
      },
    },
  ],
}
