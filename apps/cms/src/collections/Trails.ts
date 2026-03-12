import type { CollectionConfig } from 'payload'

import { DIFFICULTY_OPTIONS, ACCESS_OPTIONS } from '@blrhikes/shared'
import {
  distanceFromBangaloreCenter,
  extractTrailheadFromGpx,
  parseGpsField,
  parseGpxStats,
} from '../lib/gpx'
import { getDrivingInfoFromBangalore } from '../lib/driving'

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
      type: 'upload',
      relationTo: 'media',
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
      admin: {
        description: 'Trailhead GPS coordinates as "lat,lng" (e.g. 12.9716,77.5946)',
      },
    },
    {
      name: 'distanceFromBangalore',
      type: 'number',
      admin: {
        description:
          'Straight-line distance from Bangalore centre to trailhead in km. Auto-calculated from GPX file or gps field — do not edit manually.',
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'gpxFile',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'GPX route file. Uploading this auto-calculates distanceFromBangalore.',
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

    // Gated
    {
      name: 'mapLink',
      type: 'text',
      admin: {
        description: 'Hidden from free users in frontend',
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
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const gpxFileId =
          typeof data.gpxFile === 'object' ? data.gpxFile?.id : data.gpxFile
        const prevGpxFileId =
          typeof originalDoc?.gpxFile === 'object'
            ? originalDoc?.gpxFile?.id
            : originalDoc?.gpxFile

        const gpxChanged = gpxFileId && gpxFileId !== prevGpxFileId
        const gpsChanged = data.gps && data.gps !== originalDoc?.gps

        // Resolve trailhead coords — priority: GPX file > gps text field
        let trailhead: { lat: number; lng: number } | null = null

        if (gpxChanged) {
          try {
            const media = await req.payload.findByID({
              collection: 'media',
              id: gpxFileId,
            })
            const gpxUrl = (media as any).url as string | undefined
            if (gpxUrl) {
              const absUrl = gpxUrl.startsWith('/')
                ? `${process.env.CMS_URL || 'http://localhost:3000'}${gpxUrl}`
                : gpxUrl
              const gpxContent = await fetch(absUrl).then((r) => r.text())
              trailhead = extractTrailheadFromGpx(gpxContent)

              // Parse hiking stats from GPX track
              const stats = parseGpxStats(gpxContent)
              if (stats) {
                // Only overwrite if the field hasn't been manually set
                if (!data.length) data.length = stats.length
                if (!data.elevationGain) data.elevationGain = stats.elevationGain
                if (!data.hikingTime) data.hikingTime = stats.hikingTime
                if (!data.hikingTimeWithRests) data.hikingTimeWithRests = stats.hikingTimeWithRests
                req.payload.logger.info(
                  { stats },
                  `GPX stats parsed: ${stats.length}km, +${stats.elevationGain}m, ~${stats.hikingTime}min`,
                )
              }
            }
          } catch (err) {
            req.payload.logger.error({ err }, 'Failed to parse GPX file')
          }
        } else if (gpsChanged) {
          trailhead = parseGpsField(data.gps)
        }

        if (trailhead) {
          // Straight-line distance (no API needed)
          data.distanceFromBangalore = distanceFromBangaloreCenter(trailhead)

          // Driving distance + time via HERE Routing API
          try {
            const driving = await getDrivingInfoFromBangalore(trailhead)
            if (driving) {
              data.drivingDistance = driving.drivingDistance
              data.drivingDistanceText = driving.drivingDistanceText
              data.drivingTime = driving.drivingTime
              data.drivingTimeText = driving.drivingTimeText
            }
          } catch (err) {
            req.payload.logger.error({ err }, 'HERE Routing API call failed')
          }
        }

        return data
      },
    ],
  },
}
