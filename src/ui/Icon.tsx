type Name = "mic" | "stop" | "arrow" | "document" | "download" | "copy";

const paths: Record<Name, string> = {
  mic: "M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3ZM5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8",
  stop: "M6 6h12v12H6z",
  arrow: "M4 12h16M14 6l6 6-6 6",
  document: "M14 3H5v18h14V8l-5-5ZM14 3v5h5M8 12h8M8 16h6",
  download: "M12 3v12M7 10l5 5 5-5M4 16v5h16v-5",
  copy: "M8 8h12v13H8zM16 8V3H3v13h5",
};

export function Icon({ name }: { name: Name }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
