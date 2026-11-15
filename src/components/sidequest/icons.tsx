"use client";
import * as React from "react";
import type { IconName } from "./types";
export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const a = {
    spark: (
      <path d="m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9L12 3Zm6 11 .7 2.3 2.3 1.2-2.3 1.2L18 21l-.7-2.3-2.3-1.2 2.3-1.2L18 14ZM5 13l.9 3.1L9 17.5l-3.1 1.4L5 22l-.9-3.1L1 17.5l3.1-1.4L5 13Z" />
    ),
    home: <path d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z" />,
    search: (
      <React.Fragment>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </React.Fragment>
    ),
    calendar: (
      <React.Fragment>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </React.Fragment>
    ),
    users: (
      <React.Fragment>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
      </React.Fragment>
    ),
    settings: (
      <React.Fragment>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3A1.7 1.7 0 0 0 14 21v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14h-.2v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </React.Fragment>
    ),
    bell: (
      <React.Fragment>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </React.Fragment>
    ),
    arrow: (
      <React.Fragment>
        <path d="M5 12h14M14 7l5 5-5 5" />
      </React.Fragment>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    pin: (
      <React.Fragment>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </React.Fragment>
    ),
    clock: (
      <React.Fragment>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </React.Fragment>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    send: (
      <React.Fragment>
        <path d="m22 2-7 20-4-9-9-4 20-7Z" />
        <path d="M22 2 11 13" />
      </React.Fragment>
    ),
    close: <path d="M6 6l12 12M18 6 6 18" />,
    filter: <path d="M4 6h16M7 12h10M10 18h4" />,
    edit: (
      <React.Fragment>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </React.Fragment>
    ),
    message: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={"spark" === name || "home" === name ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {a[name]}
    </svg>
  );
}
