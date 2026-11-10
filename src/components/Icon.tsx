import type { SVGProps } from "react";

const paths = {
  image: [
    "M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm-1 13 6-6 5 5 3-3 4 4M16 7h.01",
  ],
  upload: ["M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"],
  copy: ["M9 9h12v12H9zM15 9V3H3v12h6"],
  eye: [
    "M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  ],
  refresh: [
    "M21 4v6h-6M3 20v-6h6M4 8a8 8 0 0 1 13-4l4 6M3 14l4 6a8 8 0 0 0 13-4",
  ],
  more: ["M5 12h.01M12 12h.01M19 12h.01"],
  heart: ["M20 5c-3-3-6-1-8 1C6-1-2 6 4 13l8 8 8-8c3-3 3-6 0-8Z"],
  thumb: ["M8 10 12 3c2 0 3 2 2 5h6c2 0 2 2 1 5l-2 7H8M3 10h5v11H3z"],
  grid: ["M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"],
  plus: ["M12 5v14M5 12h14"],
  arrow: ["M5 12h14m-6-6 6 6-6 6"],
  external: [
    "M14 3h7v7m0-7L10 14",
    "M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5",
  ],
  chevron: ["m9 5 7 7-7 7"],
  down: ["m6 9 6 6 6-6"],
  globe: [
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z",
  ],
  sparkle: [
    "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4m-2-2h4",
  ],
  message: [
    "M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-3 2 2-6v-4.5A8.5 8.5 0 0 1 11.5 3h1a8.5 8.5 0 0 1 8.5 8.5ZM7 9h9M7 13h6",
  ],
  layers: ["m12 3 10 5-10 5L2 8l10-5Zm-9 9 9 5 9-5M3 17l9 5 9-5"],
  search: ["M19 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Zm-2 6 5 5"],
  target: [
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-5 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 12h.01",
  ],
  bolt: ["m13 2-9 12h7l-1 8 10-13h-7l1-7Z"],
  shield: ["m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6"],
  access: [
    "M14 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM4 9l8 2 8-2M12 11v5m0 0-4 6m4-6 4 6",
  ],
  chart: ["M4 3v17h17M8 14l4-5 4 3 5-7"],
  pen: ["m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-4L4 15l-1 6Z"],
  users: [
    "M15 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM3 21v-2a6 6 0 0 1 12 0v2M17 4a4 4 0 0 1 0 8m2 4a5 5 0 0 1 2 4v1",
  ],
  compare: ["M4 3h6v18H4zM14 3h6v18h-6zM7 8h.01M17 16h.01"],
  file: [
    "M14 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9l-7-7Zm0 0v7h7M7 14h10M7 18h7",
  ],
  check: ["m5 12 4 4L19 6"],
  close: ["m6 6 12 12M6 18 18 6"],
  menu: ["M4 6h16M4 12h16M4 18h16"],
  help: [
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17h.01",
  ],
  link: [
    "m10 13 4-4M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 2 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0",
  ],
  clock: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2"],
  download: ["M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"],
  info: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 11v6M12 7h.01"],
  book: [
    "M12 5c-3-2-6-2-10-1v16c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v16",
  ],
  loader: ["M21 12a9 9 0 1 1-9-9"],
} as const;
export type IconName = keyof typeof paths;
export default function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {paths[name].map((path, index) => (
        <path d={path} key={index} />
      ))}
    </svg>
  );
}
