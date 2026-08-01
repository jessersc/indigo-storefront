'use client';

import React, { useState } from 'react';

/**
 * Home page videos in fixed 9:16 frames with no comments/chrome. Dashboard-
 * managed: each item is a TikTok/Instagram embed (video-focused player) or a
 * direct MP4 (e.g. an R2 upload). Overflow is clipped so the frame stays a clean
 * rectangle regardless of the embed's own layout.
 *
 * THIRD-PARTY EMBEDS ARE FAÇADED. A TikTok or Instagram iframe drags in that
 * platform's entire player bundle -- scripts, cookies, its own network waterfall
 * -- and four of them on the home page cost more than the rest of the page put
 * together. `loading="lazy"` did not help: these sit near the top of the home
 * page, so they are in or near the viewport immediately and load anyway.
 *
 * Instead each one renders as a poster with a play button, and the real iframe
 * is created only when the visitor asks for it. Nothing third-party is contacted
 * before that click. The frame keeps the same 9:16 box either way, so swapping
 * the poster for the iframe shifts nothing.
 *
 * Direct uploads are left alone: they are our own R2 files, no third party, and
 * the silent autoplay loop is the intended look.
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

function embedSrc(video: Video): string {
  // autoplay=1 because the visitor has just pressed play -- without it they
  // would have to press play a second time inside the platform's own player.
  return video.platform === 'tiktok'
    ? `https://www.tiktok.com/player/v1/${video.source}?music_info=0&description=0&autoplay=1`
    : `https://www.instagram.com/reel/${video.source}/embed`;
}

/** Poster + play control. Renders no third-party markup at all. */
function Facade({ video, onPlay }: { video: Video; onPlay: () => void }) {
  const label = video.title?.trim() || 'Ver video';
  // Resolved TikTok thumbnails are signed and expire. If one lapses inside the
  // cache window, fall back to the gradient rather than a broken image.
  const [posterFailed, setPosterFailed] = useState(false);
  const showPoster = Boolean(video.poster_url) && !posterFailed;
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={`Reproducir: ${label}`}
      className="group absolute inset-0 w-full h-full cursor-pointer"
    >
      {showPoster ? (
        <img
          src={video.poster_url as string}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setPosterFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        // No thumbnail stored: a branded panel beats a black rectangle, and
        // still costs nothing to render.
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-kawaii-pink/70 via-kawaii-purple/60 to-kawaii-lavender/70"
        />
      )}

      <span
        aria-hidden="true"
        className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition-colors"
      />

      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-16 h-16 rounded-full bg-white/90 shadow-lg group-hover:scale-110 transition-transform"
      >
        {/* Inline so the façade needs no icon bundle to draw itself. */}
        <svg viewBox="0 0 24 24" className="w-7 h-7 ml-1 fill-kawaii-pink">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>

      {video.title && (
        <span className="absolute bottom-0 left-0 right-0 p-3 text-left text-xs font-bold text-white bg-gradient-to-t from-black/70 to-transparent line-clamp-2">
          {video.title}
        </span>
      )}
    </button>
  );
}

function VideoFrame({ video }: { video: Video }) {
  const [playing, setPlaying] = useState(false);

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

  return (
    <div className={FRAME}>
      {playing ? (
        <iframe
          src={embedSrc(video)}
          title={video.title ?? 'video'}
          className="absolute inset-0 w-full h-full"
          style={{ border: 0 }}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        />
      ) : (
        <Facade video={video} onPlay={() => setPlaying(true)} />
      )}
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
