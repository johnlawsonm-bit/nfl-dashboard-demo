export function FootballIcon({
  className,
  strokeWidth = 1.75,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <ellipse cx="12" cy="12" rx="9" ry="5.5" transform="rotate(-40 12 12)" />
      <path d="M7.5 15 L16.5 9" />
      <path d="M9.3 11.4 L8 12.7" />
      <path d="M10.9 9.9 L9.6 11.2" />
      <path d="M12.4 8.5 L11.1 9.8" />
      <path d="M14 7 L12.7 8.3" />
    </svg>
  );
}
