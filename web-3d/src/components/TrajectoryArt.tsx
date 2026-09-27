export default function TrajectoryArt() {
  return (
    <div className="card-elevated relative mx-auto aspect-square w-full max-w-md rounded-3xl border border-border bg-white p-8">
      <svg viewBox="0 0 320 320" className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="trajGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6C4DFF" />
            <stop offset="100%" stopColor="#20C7D9" />
          </linearGradient>
        </defs>

        {/* ground */}
        <line x1="20" y1="260" x2="300" y2="260" stroke="#E6E2F7" strokeWidth="3" />
        {[60, 120, 180, 240].map((x) => (
          <line key={x} x1={x} y1="255" x2={x} y2="265" stroke="#C9C3EE" strokeWidth="2" />
        ))}

        {/* launcher */}
        <rect x="24" y="240" width="26" height="20" rx="4" fill="#3478F6" />
        <rect x="42" y="222" width="34" height="10" rx="4" fill="#3478F6" transform="rotate(-28 42 232)" />

        {/* trajectory arc */}
        <path
          d="M 58 232 Q 170 30 282 232"
          fill="none"
          stroke="url(#trajGrad)"
          strokeWidth="4"
          strokeDasharray="2 12"
          strokeLinecap="round"
        />

        {/* target */}
        <circle cx="282" cy="240" r="20" fill="none" stroke="#F4B942" strokeWidth="6" />
        <circle cx="282" cy="240" r="7" fill="#F4B942" />

        {/* floating equation chips */}
        <g fontFamily="monospace" fontSize="13" fontWeight="700">
          <rect x="120" y="60" width="76" height="28" rx="14" fill="#F0EDFF" />
          <text x="132" y="79" fill="#6C4DFF">
            R = v²/g
          </text>

          <rect x="190" y="140" width="72" height="28" rx="14" fill="#EEF5FF" />
          <text x="200" y="159" fill="#3478F6">
            F = ma
          </text>

          <rect x="40" y="150" width="76" height="28" rx="14" fill="#FEF6E4" />
          <text x="50" y="169" fill="#C98F14">
            W = Fd
          </text>
        </g>
      </svg>
    </div>
  );
}
