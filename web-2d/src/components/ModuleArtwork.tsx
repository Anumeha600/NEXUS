// Original website-only illustrations for each curriculum module's card
// artwork - promotional art representing the module's physics, never a
// rendering of the actual game (that stays in game-2d, untouched). Keyed off
// the same stable ids AVAILABLE_MODULES already uses, never a second module
// list. Visual language matches Hero's TrajectoryArt: clean vector shapes,
// soft gradients, restrained line art on a pale card background.
export type ArtworkModuleId =
  | "projectile"
  | "newton"
  | "work-energy"
  | "momentum"
  | "circular-motion";

interface ModuleArtworkProps {
  moduleId: string;
  className?: string;
}

export default function ModuleArtwork({ moduleId, className = "" }: ModuleArtworkProps) {
  const Art = ARTWORK[moduleId as ArtworkModuleId];
  if (!Art) return null;
  return <Art className={className} />;
}

interface ArtProps {
  className?: string;
}

const ARTWORK = {
  projectile: ProjectileArt,
  newton: NewtonArt,
  "work-energy": WorkEnergyArt,
  momentum: MomentumArt,
  "circular-motion": CircularMotionArt,
} satisfies Record<ArtworkModuleId, (props: ArtProps) => ReturnType<typeof ProjectileArt>>;

// Physics Park landscape: launcher, curved trajectory, target, distant hills.
function ProjectileArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 400 220" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="art-projectile-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EEF5FF" />
          <stop offset="100%" stopColor="#F8F7FF" />
        </linearGradient>
        <linearGradient id="art-projectile-arc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3478F6" />
          <stop offset="100%" stopColor="#20C7D9" />
        </linearGradient>
      </defs>

      <rect width="400" height="220" fill="url(#art-projectile-sky)" />

      {/* distant hills */}
      <path d="M -10 175 Q 90 130 210 170 L 210 220 L -10 220 Z" fill="#E6E2F7" opacity="0.7" />
      <path d="M 180 185 Q 300 145 410 178 L 410 220 L 180 220 Z" fill="#DCE6FF" opacity="0.7" />

      {/* ground */}
      <line x1="10" y1="182" x2="390" y2="182" stroke="#C9C3EE" strokeWidth="2" />

      {/* launcher */}
      <rect x="26" y="160" width="30" height="22" rx="5" fill="#3478F6" />
      <rect x="46" y="140" width="38" height="11" rx="5" fill="#3478F6" transform="rotate(-30 46 145.5)" />

      {/* trajectory */}
      <path
        d="M 62 146 Q 200 20 340 152"
        fill="none"
        stroke="url(#art-projectile-arc)"
        strokeWidth="4"
        strokeDasharray="2 12"
        strokeLinecap="round"
      />

      {/* target */}
      <circle cx="340" cy="164" r="17" fill="none" stroke="#F4B942" strokeWidth="5" />
      <circle cx="340" cy="164" r="6" fill="#F4B942" />
    </svg>
  );
}

// Stylized physics track: cart, force arrow, motion streaks.
function NewtonArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 400 220" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="art-newton-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0EDFF" />
          <stop offset="100%" stopColor="#F8F7FF" />
        </linearGradient>
        <linearGradient id="art-newton-force" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6C4DFF" />
          <stop offset="100%" stopColor="#3478F6" />
        </linearGradient>
      </defs>

      <rect width="400" height="220" fill="url(#art-newton-bg)" />

      {/* track */}
      <line x1="20" y1="168" x2="380" y2="168" stroke="#C9C3EE" strokeWidth="3" />
      {[70, 130, 190, 250, 310].map((x) => (
        <line key={x} x1={x} y1="163" x2={x} y2="173" stroke="#DCD6F7" strokeWidth="2" />
      ))}

      {/* motion streaks */}
      <line x1="70" y1="140" x2="110" y2="140" stroke="#C9C3EE" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
      <line x1="88" y1="152" x2="115" y2="152" stroke="#C9C3EE" strokeWidth="4" strokeLinecap="round" opacity="0.4" />

      {/* cart */}
      <rect x="150" y="122" width="70" height="42" rx="8" fill="#6C4DFF" />
      <rect x="160" y="110" width="34" height="16" rx="6" fill="#4F34D1" />
      <circle cx="167" cy="166" r="10" fill="#17182B" />
      <circle cx="203" cy="166" r="10" fill="#17182B" />
      <circle cx="167" cy="166" r="4" fill="#EEF5FF" />
      <circle cx="203" cy="166" r="4" fill="#EEF5FF" />

      {/* force arrow */}
      <line x1="330" y1="140" x2="234" y2="140" stroke="url(#art-newton-force)" strokeWidth="6" strokeLinecap="round" />
      <path d="M 234 140 L 254 128 L 254 152 Z" fill="#3478F6" />
      <rect x="326" y="120" width="34" height="24" rx="12" fill="#F0EDFF" />
      <text x="334" y="137" fontFamily="monospace" fontSize="14" fontWeight="700" fill="#4F34D1">
        F
      </text>
    </svg>
  );
}

// Stylized energy experiment: object on a track, force, rising energy bars.
function WorkEnergyArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 400 220" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="art-energy-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FEF6E4" />
          <stop offset="100%" stopColor="#F8F7FF" />
        </linearGradient>
        <linearGradient id="art-energy-bars" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#F4B942" />
          <stop offset="100%" stopColor="#6C4DFF" />
        </linearGradient>
      </defs>

      <rect width="400" height="220" fill="url(#art-energy-bg)" />

      {/* track */}
      <line x1="20" y1="172" x2="260" y2="172" stroke="#E9D9AE" strokeWidth="3" />

      {/* block with motion streaks */}
      <line x1="70" y1="150" x2="104" y2="150" stroke="#E9D9AE" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
      <line x1="86" y1="160" x2="112" y2="160" stroke="#E9D9AE" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
      <rect x="118" y="140" width="52" height="32" rx="7" fill="#F4B942" />

      {/* force arrow */}
      <line x1="240" y1="156" x2="180" y2="156" stroke="#C98F14" strokeWidth="6" strokeLinecap="round" />
      <path d="M 180 156 L 198 145 L 198 167 Z" fill="#C98F14" />
      <rect x="234" y="138" width="30" height="22" rx="11" fill="#FEF6E4" />
      <text x="242" y="154" fontFamily="monospace" fontSize="13" fontWeight="700" fill="#C98F14">
        F
      </text>

      {/* rising energy bars */}
      <g opacity="0.92">
        <rect x="300" y="146" width="16" height="26" rx="3" fill="url(#art-energy-bars)" />
        <rect x="323" y="126" width="16" height="46" rx="3" fill="url(#art-energy-bars)" />
        <rect x="346" y="100" width="16" height="72" rx="3" fill="url(#art-energy-bars)" />
      </g>
      <line x1="292" y1="172" x2="370" y2="172" stroke="#E9D9AE" strokeWidth="2" />
    </svg>
  );
}

// Momentum & Collisions Physics Park scene - recognizably the same game
// (elevated rail, orange Cart A, cyan Cart B, a collision at center, a
// velocity arrow) but rendered in the website's own light lavender/blue
// illustration language, matching CircularMotionArt below rather than the
// real canvas's dark night-arena palette (game-2d/src/render.ts's
// themeFor(MODULE_MOMENTUM)) - this is website promotional art, not a
// screenshot recreation, so it stays consistent with the other four cards.
function MomentumArt({ className }: ArtProps) {
  const railTopY = 150;
  const railBottomY = 160;
  const groundY = 188;

  return (
    <svg viewBox="0 0 400 220" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="art-momentum-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0EDFF" />
          <stop offset="100%" stopColor="#EAFAFC" />
        </linearGradient>
        <linearGradient id="art-momentum-rail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EFEBFF" />
          <stop offset="100%" stopColor="#C9C3EE" />
        </linearGradient>
        <linearGradient id="art-momentum-cartA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5BE9E" />
          <stop offset="100%" stopColor="#E0682C" />
        </linearGradient>
        <linearGradient id="art-momentum-cartB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9CEAF2" />
          <stop offset="100%" stopColor="#19B6D1" />
        </linearGradient>
      </defs>

      <rect width="400" height="220" fill="url(#art-momentum-sky)" />

      {/* distant hills */}
      <path d="M -10 175 Q 90 135 210 170 L 210 220 L -10 220 Z" fill="#E6E2F7" opacity="0.7" />
      <path d="M 170 182 Q 290 148 410 176 L 410 220 L 170 220 Z" fill="#DCE6FF" opacity="0.7" />

      {/* subtle greenery */}
      <g fill="#BFE3C8" opacity="0.8">
        <circle cx="44" cy={groundY - 5} r="9" />
        <circle cx="358" cy={groundY - 4} r="8" />
      </g>
      <g fill="#9FD1AE" opacity="0.7">
        <circle cx="32" cy={groundY - 2} r="6" />
        <circle cx="372" cy={groundY - 2} r="6" />
      </g>

      {/* ground */}
      <line x1="10" y1={groundY} x2="390" y2={groundY} stroke="#C9C3EE" strokeWidth="2" />

      {/* elevated physics rail on support struts */}
      <g stroke="#B9AEEB" strokeWidth="3" strokeLinecap="round" opacity="0.85">
        <line x1="90" y1={railBottomY} x2="90" y2={groundY} />
        <line x1="200" y1={railBottomY} x2="200" y2={groundY} />
        <line x1="310" y1={railBottomY} x2="310" y2={groundY} />
      </g>
      <rect x="30" y={railTopY} width="340" height={railBottomY - railTopY} rx="4" fill="url(#art-momentum-rail)" />
      <line x1="30" y1={railTopY} x2="370" y2={railTopY} stroke="#3478F6" strokeWidth="2" opacity="0.75" />

      {/* soft cart shadows */}
      <ellipse cx="140" cy={railTopY - 2} rx="28" ry="4" fill="#C9C3EE" opacity="0.5" />
      <ellipse cx="260" cy={railTopY - 2} rx="28" ry="4" fill="#C9C3EE" opacity="0.5" />

      {/* collision marker at the rail's center */}
      <line x1="200" y1={railTopY - 28} x2="200" y2={railTopY} stroke="#D1483A" strokeWidth="2" strokeDasharray="4 4" opacity="0.8" />
      <circle cx="200" cy={railTopY} r="5" fill="#F4B942" opacity="0.6" />

      {/* Cart A - orange, approaching from the left */}
      <path
        d={`M 114 ${railTopY - 4} L 121 ${railTopY - 30} L 159 ${railTopY - 30} L 166 ${railTopY - 4} Z`}
        fill="url(#art-momentum-cartA)"
      />
      <rect x="130" y={railTopY - 39} width="20" height="12" rx="3" fill="#17182B" />
      <circle cx="122" cy={railTopY - 6} r="7" fill="#17182B" />
      <circle cx="158" cy={railTopY - 6} r="7" fill="#17182B" />
      {/* velocity arrow */}
      <line x1="170" y1={railTopY - 20} x2="196" y2={railTopY - 20} stroke="#6C4DFF" strokeWidth="3" strokeLinecap="round" />
      <path d={`M 196 ${railTopY - 20} L 188 ${railTopY - 26} L 188 ${railTopY - 14} Z`} fill="#6C4DFF" />

      {/* Cart B - cyan, approaching from the right */}
      <path
        d={`M 234 ${railTopY - 4} L 241 ${railTopY - 30} L 279 ${railTopY - 30} L 286 ${railTopY - 4} Z`}
        fill="url(#art-momentum-cartB)"
      />
      <rect x="250" y={railTopY - 39} width="20" height="12" rx="3" fill="#17182B" />
      <circle cx="242" cy={railTopY - 6} r="7" fill="#17182B" />
      <circle cx="278" cy={railTopY - 6} r="7" fill="#17182B" />
    </svg>
  );
}

// Physics Park Ferris wheel: hub, spokes, cabins, support legs.
function CircularMotionArt({ className }: ArtProps) {
  const cx = 200;
  const cy = 108;
  const r = 62;
  const spokes = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);

  return (
    <svg viewBox="0 0 400 220" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="art-circular-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0EDFF" />
          <stop offset="100%" stopColor="#EAFAFC" />
        </linearGradient>
      </defs>

      <rect width="400" height="220" fill="url(#art-circular-bg)" />

      {/* ground */}
      <line x1="10" y1="188" x2="390" y2="188" stroke="#C9C3EE" strokeWidth="2" />

      {/* support legs */}
      <line x1={cx} y1={cy} x2={cx - 42} y2="188" stroke="#B9AEEB" strokeWidth="5" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={cx + 42} y2="188" stroke="#B9AEEB" strokeWidth="5" strokeLinecap="round" />

      {/* outer ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#6C4DFF" strokeWidth="3" opacity="0.55" />

      {/* spokes + cabins */}
      {spokes.map((angle, i) => {
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="#6C4DFF" strokeWidth="2" opacity="0.4" />
            <rect x={x - 8} y={y - 8} width="16" height="16" rx="4" fill={i % 2 === 0 ? "#20C7D9" : "#6C4DFF"} />
          </g>
        );
      })}

      {/* hub */}
      <circle cx={cx} cy={cy} r="9" fill="#4F34D1" />

      {/* tangent velocity arrow on top cabin */}
      <line x1={cx} y1={cy - r} x2={cx + 30} y2={cy - r} stroke="#F4B942" strokeWidth="3" strokeLinecap="round" />
      <path d={`M ${cx + 30} ${cy - r} L ${cx + 22} ${cy - r - 6} L ${cx + 22} ${cy - r + 6} Z`} fill="#F4B942" />
    </svg>
  );
}
