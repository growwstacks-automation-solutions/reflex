/* Reflex portal v3 — Lucide-style line icons (1.75px stroke, rounded). */
import type { CSSProperties, ReactNode } from "react";

export type RXIconProps = {
  size?: number;
  stroke?: string;
  fill?: string;
  sw?: number;
  style?: CSSProperties;
  d?: string;
  paths?: ReactNode;
};

export function RXIcon({
  d,
  paths,
  size = 18,
  stroke = "currentColor",
  fill = "none",
  sw = 1.75,
  style = {},
}: RXIconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {paths ? paths : <path d={d} />}
    </svg>
  );
}

export const RXIcons = {
  board: (p) => <RXIcon {...p} paths={<><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>} />,
  chat: (p) => <RXIcon {...p} d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.6 8.6 0 0 1-3.9-.9L3 21l1.9-5.1a8.5 8.5 0 1 1 16.1-4.4z" />,
  proposal: (p) => <RXIcon {...p} paths={<><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M18 21H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h8l5 5v11a1 1 0 0 1-1 1z"/><path d="M9 12h6M9 16h4"/></>} />,
  chart: (p) => <RXIcon {...p} paths={<><path d="M3 3v18h18"/><path d="M7 14l3-4 3 3 4-6"/></>} />,
  assets: (p) => <RXIcon {...p} paths={<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></>} />,
  team: (p) => <RXIcon {...p} paths={<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/></>} />,
  search: (p) => <RXIcon {...p} paths={<><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></>} />,
  sync: (p) => <RXIcon {...p} paths={<><path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.7-3M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3"/><path d="M21 3v5h-5M3 21v-5h5"/></>} />,
  sun: (p) => <RXIcon {...p} paths={<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>} />,
  moon: (p) => <RXIcon {...p} d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  external: (p) => <RXIcon {...p} paths={<><path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></>} />,
  arrowLeft: (p) => <RXIcon {...p} paths={<><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></>} />,
  copy: (p) => <RXIcon {...p} paths={<><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></>} />,
  plus: (p) => <RXIcon {...p} d="M12 5v14M5 12h14" />,
  check: (p) => <RXIcon {...p} d="M20 6L9 17l-5-5" sw={2.25} />,
  clock: (p) => <RXIcon {...p} paths={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>} />,
  upload: (p) => <RXIcon {...p} paths={<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M12 3v13M7 8l5-5 5 5"/></>} />,
  play: (p) => <RXIcon {...p} d="M7 4l13 8-13 8V4z" fill="currentColor" stroke="none" />,
  release: (p) => <RXIcon {...p} paths={<><path d="M12 3v9"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></>} />,
  bell: (p) => <RXIcon {...p} paths={<><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></>} />,
  x: (p) => <RXIcon {...p} d="M18 6 6 18M6 6l12 12" />,
  refresh: (p) => <RXIcon {...p} paths={<><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></>} />,
  funnel: (p) => <RXIcon {...p} d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z" />,
  chevronRight: (p) => <RXIcon {...p} d="M9 18l6-6-6-6" />,
  chevronDown: (p) => <RXIcon {...p} d="M6 9l6 6 6-6" />,
  send: (p) => <RXIcon {...p} paths={<><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></>} />,
  image: (p) => <RXIcon {...p} paths={<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></>} />,
  video: (p) => <RXIcon {...p} paths={<><rect x="2" y="5" width="14" height="14" rx="2"/><path d="m16 9 6-3v12l-6-3"/></>} />,
  inbox: (p) => <RXIcon {...p} paths={<><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.5 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.5A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.5z"/></>} />,
  link: (p) => <RXIcon {...p} paths={<><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></>} />,
  dot: (p) => <RXIcon {...p} d="M12 12h.01" sw={6} />,
  spark: (p) => <RXIcon {...p} d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3z" />,
  puzzle: (p) => <RXIcon {...p} d="M4 7h3.5a1.5 1.5 0 1 1 3 0H14a1 1 0 0 1 1 1v3.5a1.5 1.5 0 1 0 0 3V18a1 1 0 0 1-1 1h-3.5a1.5 1.5 0 1 0-3 0H4a1 1 0 0 1-1-1v-3.5a1.5 1.5 0 1 0 0-3V8a1 1 0 0 1 1-1z" />,
  download: (p) => <RXIcon {...p} paths={<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M12 3v13M7 11l5 5 5-5"/></>} />,
  briefcase: (p) => <RXIcon {...p} paths={<><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><path d="M2 13h20"/></>} />,
  trash: (p) => <RXIcon {...p} paths={<><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></>} />,
  edit: (p) => <RXIcon {...p} paths={<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>} />,
  grip: (p) => <RXIcon {...p} sw={2} paths={<><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></>} />,
} satisfies Record<string, (p: RXIconProps) => JSX.Element>;

export type RXIconName = keyof typeof RXIcons;
