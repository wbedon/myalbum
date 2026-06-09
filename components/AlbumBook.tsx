'use client'

import dynamic from 'next/dynamic'
import type { AlbumSlot } from '@/lib/supabase'

interface Props {
  slots: AlbumSlot[]
  bySlot: Map<string, Array<{ image_url: string }>>
  portadaUrl: string | null
  contraportadaUrl: string | null
  albumName: string
  totalSlots: number
  collectedCount: number
}

const AlbumBookDynamic = dynamic<Props>(
  () => import('./AlbumBookInner'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-mundial-purple/20 border-t-mundial-purple animate-spin" />
      </div>
    ),
  },
)

export default function AlbumBook(props: Props) {
  return <AlbumBookDynamic {...props} />
}
