'use client'

import React from 'react'
import { Play, Lock, CheckCircle } from 'lucide-react'

interface VideoThumbnailProps {
  youtubeId: string
  title: string
  durationText?: string
  isLocked?: boolean
  isCompleted?: boolean
  className?: string
}

/**
 * Canonical YouTube video thumbnail for every video card in the app.
 *
 * Owns the overlay (bg-black/15), play button, lock state, duration badge,
 * and completed badge in one place. Import here — never repeat inline.
 *
 * Scoped to YouTube video thumbnails only. Do not use for illustrations,
 * coach portraits, or condition icons.
 */
export function VideoThumbnail({
  youtubeId,
  title,
  durationText,
  isLocked = false,
  isCompleted = false,
  className = '',
}: VideoThumbnailProps) {
  const src = `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`

  return (
    <div
      className={`aspect-video w-full bg-divider/10 relative overflow-hidden flex items-center justify-center ${className}`}
    >
      {/* Source thumbnail */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={title}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* 
          CODE COMMENT: This overlay has regressed twice. It must remain part of the 
          core structure of the VideoThumbnail component and not be made conditional or optional.
          Canonical tone-down overlay — desaturates aggressive clickbait thumbnails 
          without hiding content. Applied to every YouTube card automatically.
      */}
      <div className="absolute inset-0 bg-[#100808]/15" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#100808]/50 via-[#100808]/10 to-transparent pointer-events-none" />

      {isLocked ? (
        /* Lock state: additional darkening + blur over the base overlay */
        <div className="absolute inset-0 bg-text-primary/20 backdrop-blur-[2px] flex items-center justify-center text-on-primary">
          <div className="h-10 w-10 rounded-full bg-text-primary/60 border border-on-primary/25 flex items-center justify-center">
            <Lock className="h-4 w-4" />
          </div>
        </div>
      ) : (
        /* Play button */
        <div className="absolute h-12 w-12 rounded-full bg-background/95 shadow-md flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
          <Play className="h-5 w-5 fill-current ml-0.5" />
        </div>
      )}

      {/* Completed badge — top-left */}
      {isCompleted && !isLocked && (
        <div className="absolute top-2.5 left-3 flex items-center gap-1 bg-success/90 text-on-primary text-[9px] font-bold px-2 py-0.5 rounded-full">
          <CheckCircle className="h-2.5 w-2.5" />
          Done
        </div>
      )}

      {/* Duration badge — bottom-right */}
      {durationText && (
        <span className="absolute bottom-3 right-3 text-[10px] font-bold text-on-primary bg-text-primary/70 px-2 py-0.5 rounded">
          {durationText}
        </span>
      )}
    </div>
  )
}
