import { useId } from "react";

export type MarkState = "idle" | "listening" | "speaking" | "offline";

/** The Jarvis mark: a disc with three voice bars. The bars move when Jarvis speaks, the ring pulses while it listens. */
export function JarvisMark({ size = 32, state = "idle" }: { size?: number; state?: MarkState }) {
  const id = useId();
  return (
    <svg className={`mark ${state}`} width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="Jarvis">
      <defs>
        <linearGradient id={id} x1="8" y1="2" x2="32" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4f6dff" />
          <stop offset="1" stopColor="#1c33b8" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill={`url(#${id})`} />
      <rect className="bar" x="12" y="16" width="3.4" height="8" rx="1.7" fill="#fff" />
      <rect className="bar" x="18.3" y="11.5" width="3.4" height="17" rx="1.7" fill="#fff" />
      <rect className="bar" x="24.6" y="16" width="3.4" height="8" rx="1.7" fill="#fff" />
    </svg>
  );
}
