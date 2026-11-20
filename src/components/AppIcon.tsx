/** The app's own mark, so a connection is recognised at a glance. Unknown apps get a neutral plug. */
export function AppIcon({ app, size = 22 }: { app: string; size?: number }) {
  const key = app.toLowerCase();
  const id = key.includes("gmail") ? "gmail" : key.includes("calendar") ? "calendar" : key.includes("drive") ? "drive" : key.includes("whatsapp") ? "whatsapp" : key.includes("instagram") ? "instagram" : key.includes("phone") || key.includes("call") ? "phone" : key.includes("search") ? "search" : key.includes("computer") ? "computer" : key.includes("gemini") ? "gemini" : key.includes("remind") ? "reminders" : "other";
  const box = { width: size, height: size, "aria-hidden": true } as const;
  switch (id) {
    case "gmail":
      return (
        <svg {...box} viewBox="52 42 88 66">
          <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
          <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
          <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
          <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92" />
          <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...box} viewBox="0 0 24 24">
          <path fill="#fff" d="M6.5 6.5h11v11h-11z" />
          <path fill="#4285f4" d="M4 2.5h13.5v4H6.5v11h-4V4A1.5 1.5 0 0 1 4 2.5z" />
          <path fill="#1967d2" d="M17.5 2.5H20A1.5 1.5 0 0 1 21.500 4v2.5h-4z" />
          <path fill="#fbbc04" d="M17.5 6.5h4v11h-4z" />
          <path fill="#34a853" d="M6.5 17.5h11v4h-11z" />
          <path fill="#188038" d="M2.5 17.5h4v4H4A1.5 1.5 0 0 1 2.5 20z" />
          <path fill="#ea4335" d="M17.5 17.5h4l-4 4z" />
          <text x="12" y="15.2" textAnchor="middle" fontSize="7.6" fontWeight="700" fill="#4285f4" fontFamily="Arial, Helvetica, sans-serif">31</text>
        </svg>
      );
    case "drive":
      return (
        <svg {...box} viewBox="0 0 87.3 78">
          <path fill="#0066da" d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" />
          <path fill="#00ac47" d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" />
          <path fill="#ea4335" d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" />
          <path fill="#00832d" d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" />
          <path fill="#2684fc" d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" />
          <path fill="#ffba00" d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg {...box} viewBox="0 0 24 24">
          <path fill="#25d366" d="M12 1.5A10.5 10.5 0 0 0 2.9 17.2L1.500 22.500l5.450-1.350A10.5 10.5 0 1 0 12 1.500z" />
          <path fill="#fff" d="M9.1 6.600c-.2-.5-.45-.5-.65-.5h-.55c-.2 0-.5.070-.77.360-.26.290-1 .980-1 2.390s1.030 2.770 1.170 2.960c.14.190 2 3.180 4.930 4.330 2.440.960 2.930.770 3.460.720.530-.050 1.700-.690 1.940-1.360.240-.670.240-1.240.170-1.360-.070-.120-.260-.190-.550-.340-.290-.140-1.700-.840-1.960-.930-.260-.100-.450-.140-.650.140-.190.290-.740.930-.910 1.120-.170.190-.340.220-.620.070-.290-.140-1.210-.450-2.310-1.420-.850-.760-1.430-1.700-1.600-1.980-.170-.290-.020-.440.130-.590.130-.130.290-.340.430-.500.140-.170.190-.290.290-.480.100-.190.050-.360-.020-.500-.070-.140-.640-1.560-.880-2.130z" />
        </svg>
      );
    case "instagram":
      return (
        <svg {...box} viewBox="0 0 24 24">
          <defs>
            <linearGradient id="app-ig" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#feda75" />
              <stop offset="0.3" stopColor="#fa7e1e" />
              <stop offset="0.55" stopColor="#d62976" />
              <stop offset="0.8" stopColor="#962fbf" />
              <stop offset="1" stopColor="#4f5bd5" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="5.5" fill="url(#app-ig)" />
          <rect x="5.6" y="5.6" width="12.8" height="12.8" rx="3.6" fill="none" stroke="#fff" strokeWidth="1.6" />
          <circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" strokeWidth="1.6" />
          <circle cx="16.1" cy="7.9" r="0.95" fill="#fff" />
        </svg>
      );
    case "phone":
      return (
        <svg {...box} viewBox="0 0 24 24">
          <rect x="2" y="2" width="20" height="20" rx="5.5" fill="#1f9d55" />
          <path fill="#fff" transform="translate(4.8 4.8) scale(0.6)" d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
        </svg>
      );
    case "search":
      return (
        <svg {...box} viewBox="0 0 24 24">
          <path fill="#4285F4" d="M21.6 12.23c0-.68-.06-1.33-.17-1.96H12v3.7h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.9-1.75 2.99-4.32 2.99-7.26z" />
          <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.23-2.5c-.9.6-2.04.95-3.39.95-2.6 0-4.81-1.76-5.6-4.12H3.07v2.59A10 10 0 0 0 12 22z" />
          <path fill="#FBBC05" d="M6.4 13.9A6 6 0 0 1 6.08 12c0-.66.11-1.3.32-1.9V7.51H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.49z" />
          <path fill="#EA4335" d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.51L6.4 10.1C7.19 7.74 9.4 5.98 12 5.98z" />
        </svg>
      );
    case "computer":
      return (
        <svg {...box} viewBox="0 0 24 24">
          <rect x="2" y="2" width="20" height="20" rx="5.5" fill="#2747e6" />
          <rect x="5.5" y="6.5" width="13" height="9" rx="1.6" fill="none" stroke="#fff" strokeWidth="1.6" />
          <path d="M9.5 18h5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M8.3 9.3h7.4" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".7" />
        </svg>
      );
    case "gemini":
      return (
        <svg {...box} viewBox="0 0 24 24">
          <defs><linearGradient id="app-gem" x1="3" y1="3" x2="21" y2="21"><stop stopColor="#4285F4" /><stop offset=".55" stopColor="#9B72CB" /><stop offset="1" stopColor="#D96570" /></linearGradient></defs>
          <path fill="url(#app-gem)" d="M12 2c.6 5.3 4.7 9.4 10 10-5.3.6-9.4 4.7-10 10-.6-5.3-4.7-9.4-10-10 5.3-.6 9.4-4.7 10-10z" />
        </svg>
      );
    case "reminders":
      return (
        <svg {...box} viewBox="0 0 24 24">
          <rect x="2" y="2" width="20" height="20" rx="5.5" fill="#f29900" />
          <circle cx="12" cy="12.6" r="5.4" fill="none" stroke="#fff" strokeWidth="1.6" />
          <path d="M12 10v2.8l1.8 1.1M8.2 5.6 6.4 7.2M15.8 5.6l1.8 1.6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
      );
    default:
      return (
        <svg {...box} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 3v4M15 3v4M7 7h10v4a5 5 0 0 1-10 0zM12 16v5" />
        </svg>
      );
  }
}
