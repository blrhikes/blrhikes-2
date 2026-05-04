import type { CollectionConfig, FieldAccess } from 'payload'

import { DIFFICULTY_OPTIONS, ACCESS_OPTIONS } from '@blrhikes/shared'
import {
  distanceFromBangaloreCenter,
  extractTrailheadFromGpx,
  getRelativeLocationFromBangalore,
  parseGpsField,
  parseGpxStats,
} from '../lib/gpx'
import {
  getDrivingInfoFromBangalore,
  getShortestRoadDistanceFromBangalore,
} from '../lib/driving'

// Shared gating predicate: can this user read gated content for this trail?
// Covers admin/contributor, lifetime members, non-expired yearly members,
// and one-off trail purchases.
const canAccessGated = (req: any, doc: any): boolean => {
  const user = req.user
  if (!user) return false
  const role = user.role as string
  if (role === 'admin' || role === 'contributor') return true
  if (role === 'lifetime') return true
  if (role === 'yearly') {
    const expiresAt = user.membershipExpiresAt as string | undefined
    if (!expiresAt) return false
    return new Date(expiresAt) > new Date()
  }
  if (doc?.id && Array.isArray(user.trailPurchases)) {
    return user.trailPurchases.some(
      (t: any) => (typeof t === 'object' ? t.id : t) === doc.id,
    )
  }
  return false
}

const isEditor = (req: any): boolean => {
  const role = req.user?.role
  return role === 'admin' || role === 'contributor'
}

const canReadGatedField: FieldAccess = ({ req, doc }) => canAccessGated(req, doc)

const slugify = (input: string): string =>
  input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

export const Trails: CollectionConfig = {
  slug: 'trails',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'altName', 'area', 'difficulty', 'status'],
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
      name: 'gallery',
      type: 'array',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
        {
          name: 'caption',
          type: 'text',
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
      name: 'relativeLocation',
      type: 'text',
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

    // Auto-calculated stats — populated by the beforeChange hook from gpxFile.
    // Grouped in a collapsed panel so editors see them but don't mistake them for manual input.
    {
      type: 'collapsible',
      label: 'Auto-calculated (from GPX)',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'gps',
          type: 'text',
          access: { read: canReadGatedField },
          admin: {
            description: 'Trailhead GPS as "lat,lng". Auto-populated from GPX.',
            readOnly: true,
          },
        },
        {
          name: 'distanceFromBangalore',
          type: 'number',
          admin: {
            description:
              'Shortest road distance from Cubbon Park to trailhead (km) via HERE (routingMode=short); falls back to straight-line if HERE is unavailable.',
            readOnly: true,
          },
        },
        {
          name: 'length',
          type: 'number',
          admin: { description: 'Trail length in km', readOnly: true },
        },
        {
          name: 'elevationGain',
          type: 'number',
          admin: { description: 'Elevation gain in meters', readOnly: true },
        },
        {
          name: 'elevation',
          type: 'number',
          admin: { description: 'Peak elevation in meters', readOnly: true },
        },
        {
          name: 'drivingDistance',
          type: 'number',
          admin: { description: 'Driving distance in km', readOnly: true },
        },
        {
          name: 'drivingDistanceText',
          type: 'text',
          admin: { readOnly: true },
        },
        {
          name: 'drivingTime',
          type: 'number',
          admin: { description: 'Driving time in minutes', readOnly: true },
        },
        {
          name: 'drivingTimeText',
          type: 'text',
          admin: { readOnly: true },
        },
        {
          name: 'hikingTime',
          type: 'number',
          admin: { description: 'Hiking time in minutes (Naismith base)', readOnly: true },
        },
        {
          name: 'hikingTimeWithRests',
          type: 'number',
          admin: { description: 'Hiking time with rests (2x base)', readOnly: true },
        },
        {
          name: 'hikingTimeWithExploration',
          type: 'number',
          admin: { description: 'Hiking time with rests + exploration (3x base)', readOnly: true },
        },
      ],
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
        description: 'GPX track file. Auto-calculates trail stats on upload.',
      },
    },

    // Legacy content — single markdown blob. Kept during Phase A migration;
    // the web app prefers `sections` when non-empty. Dropped after the port
    // lands in prod (see docs/content-sections-plan.md §6).
    {
      name: 'content',
      type: 'textarea',
      admin: {
        description: 'Legacy. Use Sections below instead.',
      },
    },

    // Structured sections. Each row is one section of the trail page,
    // optionally gated to members. See docs/content-sections-plan.md §2.
    {
      name: 'sections',
      type: 'array',
      labels: { singular: 'Section', plural: 'Sections' },
      admin: {
        description: 'Ordered sections rendered on the trail page.',
      },
      fields: [
        {
          name: 'heading',
          type: 'text',
          required: true,
        },
        {
          name: 'slug',
          type: 'text',
          required: true,
          admin: {
            description:
              'Anchor id. Auto-derived from the heading; editable. Must be unique within this trail.',
          },
        },
        {
          name: 'visibility',
          type: 'select',
          required: true,
          defaultValue: 'public',
          options: [
            { label: 'Public', value: 'public' },
            { label: 'Members only', value: 'members' },
          ],
        },
        {
          name: 'published',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description:
              'Uncheck to hide this section from the site. Editors still see it.',
          },
        },
        {
          name: 'body',
          type: 'textarea',
          admin: {
            description: 'Section body in markdown.',
          },
        },
        {
          name: 'attachments',
          type: 'array',
          admin: {
            description: 'Downloadable files attached to this section.',
          },
          fields: [
            {
              name: 'file',
              type: 'upload',
              relationTo: ['gpx-files', 'media'],
              required: true,
            },
            {
              name: 'label',
              type: 'text',
            },
          ],
        },
        {
          // Stable id stamped by the port script. Used as the upsert key so
          // editors renaming a heading in the CMS doesn't cause duplicates
          // on re-run. Editor-authored sections have this empty.
          name: 'sourceRef',
          type: 'text',
          admin: {
            readOnly: true,
            description: 'Migration source id. Do not edit.',
          },
        },
      ],
    },

    // Gallery — replaces the old `photos` array. One gallery per trail.
    // Rendered on the detail page as a view-transitions grid.
    // (Kept here near `sections` so editors see it as related content.)

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
    beforeValidate: [
      // Trail-level slug: auto-derive from altName (or title as fallback) so
      // editors never have to type it. Final canonical form is
      // `<slugified-altName>-<num>` where num is githubIssueNumber when set,
      // otherwise the Payload row id. The suffix is stamped in afterChange on
      // create (since row id doesn't exist pre-insert).
      // Existing `...-<digits>` slugs are preserved untouched (so editors can
      // rename altName without breaking URLs).
      ({ data, originalDoc }) => {
        if (!data) return data
        const currentSlug = data.slug?.trim?.()
        const hasNumericSuffix = currentSlug && /-\d+$/.test(currentSlug)
        if (hasNumericSuffix) return data

        const ghNum = data.githubIssueNumber ?? originalDoc?.githubIssueNumber
        const fallbackId = originalDoc?.id
        const num = ghNum ?? fallbackId
        const base = slugify(data.altName || data.title || '') || `trail-${num ?? 'new'}`
        // If we already know a number (gh issue or existing row id), bake it
        // in here; otherwise leave the bare slug and let afterChange finalize.
        if (num != null) {
          data.slug = `${base}-${num}`
        } else {
          data.slug = base
        }
        return data
      },
      // Auto-populate & de-duplicate section slugs within a trail.
      // Runs before Payload validates `sections[].slug` (required), so empty
      // slugs get derived from the heading. Duplicates (editor-authored or
      // derived collisions) are resolved deterministically with -2/-3… suffixes.
      ({ data }) => {
        if (!data || !Array.isArray(data.sections)) return data
        const seen = new Set<string>()
        data.sections = data.sections.map((section: any) => {
          const desired = (section?.slug && String(section.slug).trim()) || slugify(section?.heading || '') || 'section'
          let candidate = desired
          let i = 2
          while (seen.has(candidate)) {
            candidate = `${desired}-${i}`
            i++
          }
          seen.add(candidate)
          return { ...section, slug: candidate }
        })
        return data
      },
    ],
    afterChange: [
      // Finalize the trail slug with the suffix after create.
      // Prefer githubIssueNumber; fall back to Payload row id (which only
      // exists post-insert, hence afterChange).
      async ({ doc, operation, req, previousDoc }) => {
        if (operation !== 'create') return doc
        const current = doc?.slug as string | undefined
        if (!current) return doc
        if (/-\d+$/.test(current)) return doc // already canonicalized

        const ghNum = doc?.githubIssueNumber as number | null | undefined
        const num = ghNum ?? (doc?.id as number | string | undefined)
        if (num == null) return doc // shouldn't happen post-insert, but guard anyway

        const canonical = `${current}-${num}`
        try {
          await req.payload.update({
            collection: 'trails',
            id: doc.id,
            data: { slug: canonical },
          })
          doc.slug = canonical
        } catch (err) {
          req.payload.logger.warn(
            { err, trailId: doc.id },
            'Trail slug canonicalization (numeric suffix) failed',
          )
        }
        void previousDoc
        return doc
      },
    ],
    afterRead: [
      // Row-level gating for `sections`. Payload's field-access runs on the
      // whole field, not per-row — so we strip rows here instead.
      //   - published === false → drop row entirely for non-editors
      //   - visibility === 'members' & not entitled → wipe body + attachments,
      //     leave heading/slug so the TOC still renders a locked stub
      ({ doc, req }) => {
        if (!doc || !Array.isArray(doc.sections)) return doc
        if (isEditor(req)) return doc
        const entitled = canAccessGated(req, doc)
        doc.sections = doc.sections
          .filter((s: any) => s?.published !== false)
          .map((s: any) => {
            if (s?.visibility === 'members' && !entitled) {
              return { ...s, body: null, attachments: [] }
            }
            return s
          })
        return doc
      },
    ],
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const gpxFileId =
          typeof data.gpxFile === 'object' ? data.gpxFile?.id : data.gpxFile
        const prevGpxFileId =
          typeof originalDoc?.gpxFile === 'object'
            ? originalDoc?.gpxFile?.id
            : originalDoc?.gpxFile

        const gpxChanged = gpxFileId && gpxFileId !== prevGpxFileId

        // Two recalc modes:
        //   - gpxChanged   → overwrite all derived fields with stats from the new GPX
        //   - !gpxChanged  → fill only the fields that are currently empty (clearing
        //                    any auto-calc field in the DB / via API triggers a refill
        //                    on the next save from the current GPX)
        const merged = { ...(originalDoc ?? {}), ...data }
        const derivedKeys = [
          'gps',
          'length',
          'elevationGain',
          'elevation',
          'hikingTime',
          'hikingTimeWithRests',
          'hikingTimeWithExploration',
          'distanceFromBangalore',
          'drivingDistance',
          'drivingDistanceText',
          'drivingTime',
          'drivingTimeText',
          'relativeLocation',
        ] as const
        const hasMissingDerived = derivedKeys.some((k) => {
          const v = (merged as Record<string, unknown>)[k]
          return v === null || v === undefined || v === ''
        })

        const gpsChanged = data.gps && data.gps !== originalDoc?.gps

        // On gpxChanged, force-write every derived field; otherwise gate on emptiness.
        const shouldWrite = (key: (typeof derivedKeys)[number]): boolean => {
          if (gpxChanged) return true
          const v = (merged as Record<string, unknown>)[key]
          return v === null || v === undefined || v === ''
        }

        let trailhead: { lat: number; lng: number } | null = null

        if (gpxFileId && (gpxChanged || hasMissingDerived)) {
          try {
            const media = await req.payload.findByID({
              collection: 'gpx-files',
              id: gpxFileId,
            })
            const gpxUrl = (media as any).url as string | undefined
            if (gpxUrl) {
              const absUrl = gpxUrl.startsWith('/')
                ? `${process.env.PAYLOAD_SERVER_URL || 'http://localhost:3000'}${gpxUrl}`
                : gpxUrl
              const gpxContent = await fetch(absUrl).then((r) => r.text())
              trailhead = extractTrailheadFromGpx(gpxContent)

              if (trailhead && shouldWrite('gps')) {
                data.gps = `${trailhead.lat},${trailhead.lng}`
              }

              const stats = parseGpxStats(gpxContent)
              if (stats) {
                if (shouldWrite('length')) data.length = stats.length
                if (shouldWrite('elevationGain')) data.elevationGain = stats.elevationGain
                if (shouldWrite('elevation') && stats.peakElevation !== null)
                  data.elevation = stats.peakElevation
                if (shouldWrite('hikingTime')) data.hikingTime = stats.hikingTime
                if (shouldWrite('hikingTimeWithRests'))
                  data.hikingTimeWithRests = stats.hikingTimeWithRests
                if (shouldWrite('hikingTimeWithExploration'))
                  data.hikingTimeWithExploration = stats.hikingTimeWithExploration
                req.payload.logger.info(
                  { stats },
                  `GPX stats: ${stats.length}km, +${stats.elevationGain}m, ~${stats.hikingTime}min`,
                )
              }
            }
          } catch (err) {
            req.payload.logger.error({ err }, 'Failed to parse GPX file')
          }
        } else {
          // Fall back to the gps text field — either explicitly changed in
          // this save, or already set and we're missing derived fields that
          // a trailhead can fill (e.g. relativeLocation on a trail saved
          // before this field was auto-populated).
          const effectiveGps =
            (data.gps as string | undefined) ?? (originalDoc?.gps as string | undefined)
          if (effectiveGps && (gpsChanged || hasMissingDerived)) {
            trailhead = parseGpsField(effectiveGps)
          }
        }

        if (trailhead) {
          const needsFastRoute =
            shouldWrite('drivingDistance') ||
            shouldWrite('drivingTime') ||
            shouldWrite('drivingDistanceText') ||
            shouldWrite('drivingTimeText')
          if (needsFastRoute) {
            try {
              const driving = await getDrivingInfoFromBangalore(trailhead)
              if (driving) {
                if (shouldWrite('drivingDistance')) data.drivingDistance = driving.drivingDistance
                if (shouldWrite('drivingDistanceText'))
                  data.drivingDistanceText = driving.drivingDistanceText
                if (shouldWrite('drivingTime')) data.drivingTime = driving.drivingTime
                if (shouldWrite('drivingTimeText')) data.drivingTimeText = driving.drivingTimeText
              }
            } catch (err) {
              req.payload.logger.error({ err }, 'HERE Routing API (fast) call failed')
            }
          }

          // distanceFromBangalore = shortest road distance (HERE routingMode=short),
          // fall back to straight-line Haversine when HERE is unavailable.
          if (shouldWrite('distanceFromBangalore')) {
            let shortest: number | null = null
            try {
              shortest = await getShortestRoadDistanceFromBangalore(trailhead)
            } catch (err) {
              req.payload.logger.error({ err }, 'HERE Routing API (short) call failed')
            }
            data.distanceFromBangalore = shortest ?? distanceFromBangaloreCenter(trailhead)
          }

          // relativeLocation = 8-point compass from Bangalore center
          // (north / northeast / east / …). Pure function, no network call.
          if (shouldWrite('relativeLocation')) {
            const compass = getRelativeLocationFromBangalore(trailhead)
            if (compass) data.relativeLocation = compass
          }
        }

        return data
      },
    ],
  },
}
