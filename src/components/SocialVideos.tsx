'use client';

import React from 'react';

/**
 * Home page videos in fixed 9:16 frames with no comments/chrome. Dashboard-
 * managed: each item is a TikTok/Instagram embed (video-focused player) or a
 * direct MP4 (e.g. an R2 upload). Overflow is clipped so the frame stays a clean
 * rectangle regardless of the embed's own layout.
 */

interface Video {
  id: string;
  platform: 'tiktok' | 'instagram' | 'upload';
  source: string;
  poster_url?: string | null;
  title?: string | null;
}

const FRAME =
  'relative aspect-[9/16] rounded-3xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-white/40 bg-black';

function VideoFrame({ video }: { video: Video }) {
  if (video.platform === 'upload') {
    return (
      <div className={FRAME}>
        <video
          src={video.source}
          poster={video.poster_url ?? undefined}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          loop
          autoPlay
          playsInline
        />
      </div>
    );
  }

  // Video-focused embed players (no comment thread).
  const src =
    video.platform === 'tiktok'
      ? `https://www.tiktok.com/player/v1/${video.source}?music_info=0&description=0`
      : `https://www.instagram.com/reel/${video.source}/embed`;

  return (
    <div className={FRAME}>
      <iframe
        src={src}
        title={video.title ?? 'video'}
        className="absolute inset-0 w-full h-full"
        style={{ border: 0 }}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        loading="lazy"
      />
    </div>
  );
}

export default function SocialVideos({ videos }: { videos: Video[] }) {
  if (!videos || videos.length === 0) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {videos.map((v) => (
        <VideoFrame key={v.id} video={v} />
      ))}
    </div>
  );
}
