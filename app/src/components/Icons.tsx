import React from 'react'

type P = React.SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 24, ...props }: P) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  }
}

export const Play = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14Z" />
  </svg>
)
export const Pause = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <rect x="6" y="4" width="4.2" height="16" rx="1.2" />
    <rect x="13.8" y="4" width="4.2" height="16" rx="1.2" />
  </svg>
)
export const Home = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 10.2 12 3l9 7.2" />
    <path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </svg>
)
export const Search = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </svg>
)
export const Download = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3v12" />
    <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
    <path d="M4 17v2.5a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5V17" />
  </svg>
)
export const Library = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="6" height="16" rx="1.4" />
    <rect x="10.5" y="4" width="4.5" height="16" rx="1.4" />
    <path d="m17.5 6.2 3.2 14.1" />
  </svg>
)
export const Settings = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.87 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.87-1.2l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.06A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6h.08A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.06A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.08A1.7 1.7 0 0 0 21 10h.06a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z" />
  </svg>
)
export const Bookmark = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4.2L5 20V5a1 1 0 0 1 1-1Z" />
  </svg>
)
export const BookmarkFilled = (p: P) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4.2L5 20V5a1 1 0 0 1 1-1Z" />
  </svg>
)
export const Back = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 5 8 12l7 7" />
  </svg>
)
export const Close = (p: P) => (
  <svg {...base(p)}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
)
export const Star = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="m12 3.4 2.6 5.3 5.9.86-4.25 4.14 1 5.87L12 16.8l-5.25 2.77 1-5.87L3.5 9.56l5.9-.86Z" />
  </svg>
)
export const Next = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M5 5.2v13.6a1 1 0 0 0 1.53.85l9.1-6.8a1 1 0 0 0 0-1.7L6.53 4.35A1 1 0 0 0 5 5.2Z" />
    <rect x="17.6" y="4.6" width="2.6" height="14.8" rx="1.1" />
  </svg>
)
export const Prev = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M19 5.2v13.6a1 1 0 0 1-1.53.85l-9.1-6.8a1 1 0 0 1 0-1.7l9.1-6.8A1 1 0 0 1 19 5.2Z" />
    <rect x="3.8" y="4.6" width="2.6" height="14.8" rx="1.1" />
  </svg>
)
export const Rewind = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 8.5V4M3.5 8.5H8" />
    <path d="M3.9 8.6A9 9 0 1 1 3 14" />
  </svg>
)
export const Forward = (p: P) => (
  <svg {...base(p)}>
    <path d="M20.5 8.5V4M20.5 8.5H16" />
    <path d="M20.1 8.6A9 9 0 1 0 21 14" />
  </svg>
)
export const Volume = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 9.5h3L12 5v14l-5-4.5H4z" />
    <path d="M16 9a4.2 4.2 0 0 1 0 6" />
    <path d="M18.8 6.4a8 8 0 0 1 0 11.2" />
  </svg>
)
export const VolumeOff = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 9.5h3L12 5v14l-5-4.5H4z" />
    <path d="m16.5 9.5 5 5M21.5 9.5l-5 5" />
  </svg>
)
export const Expand = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 9V5a1 1 0 0 1 1-1h4" />
    <path d="M20 9V5a1 1 0 0 0-1-1h-4" />
    <path d="M4 15v4a1 1 0 0 0 1 1h4" />
    <path d="M20 15v4a1 1 0 0 1-1 1h-4" />
  </svg>
)
export const Shrink = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 4v4a1 1 0 0 1-1 1H4" />
    <path d="M15 4v4a1 1 0 0 0 1 1h4" />
    <path d="M9 20v-4a1 1 0 0 0-1-1H4" />
    <path d="M15 20v-4a1 1 0 0 1 1-1h4" />
  </svg>
)
export const Check = (p: P) => (
  <svg {...base(p)}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
)
export const Trash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16" />
    <path d="M9 7V4.8A.8.8 0 0 1 9.8 4h4.4a.8.8 0 0 1 .8.8V7" />
    <path d="M6.5 7 7.4 19a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9L17.5 7" />
  </svg>
)
export const Info = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6" />
    <circle cx="12" cy="7.6" r="1" fill="currentColor" stroke="none" />
  </svg>
)
export const Layers = (p: P) => (
  <svg {...base(p)}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3.5 12.5 8.5 4.7 8.5-4.7" />
    <path d="m3.5 17 8.5 4.7 8.5-4.7" />
  </svg>
)
export const Wifi = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 9.5a13 13 0 0 1 16 0" />
    <path d="M7 13a8.5 8.5 0 0 1 10 0" />
    <path d="M10 16.4a4 4 0 0 1 4 0" />
    <circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none" />
  </svg>
)
export const Refresh = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 11a8 8 0 1 0-2.3 6.1" />
    <path d="M20 4v7h-7" />
  </svg>
)
export const Cast = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 19.5a1.5 1.5 0 0 1 3 0" />
    <path d="M3 15a6 6 0 0 1 6 6" />
    <path d="M3 10a11 11 0 0 1 11 11" />
    <path d="M8 4.5h11a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-3" />
  </svg>
)
export const Clock = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7.5V12l3 1.8" />
  </svg>
)
