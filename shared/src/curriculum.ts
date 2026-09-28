// --------------------------------------------------------------------------
// NEXUS CURRICULUM - the one authoritative module/concept definition
//
// Mirrors the module/concept structure defined in
// game-3d/scripts/learning_content.gd and game-2d/src/adaptiveEngine.ts.
// This is DISPLAY metadata only (titles, descriptions, ordering, visual
// theme, availability) - it does not decide mastery, difficulty, or
// progression. That remains each game runtime's adaptive engine (Godot
// GDScript for game-3d, TypeScript for game-2d). Both web-2d and web-3d
// import this so the curriculum is defined exactly once across the whole
// product.
//
// STABLE MODULE IDS
// `id` below is the stable, external-facing module identifier: used in
// /play?module=<id> routing, dashboard links, and (once a module has a
// working game) as the module field module-specific tooling keys off of.
// It is deliberately NOT the same string as the adaptive engine's internal
// module id (e.g. AdaptiveEngine's MODULE_PROJECTILE = "projectile_motion")
// - that internal id is already load-bearing across game-2d, the learning
// event schema, the AI insight fallback, and game-3d's GDScript, and
// renaming it now would be a large, risky change for no product benefit.
// `engineModuleId` is the bridge between the two: set only for modules that
// actually have a working adaptive engine + game behind them. A module with
// `available: false` has no engine yet, so `engineModuleId` is undefined.
// --------------------------------------------------------------------------

// A variable appearing in a concept's formula - kept as symbol/meaning pairs
// (rather than folding meanings into the formula string) so the Learn page
// can render "FORMULA" and "VARIABLES" as two distinct blocks.
export interface ConceptVariable {
  symbol: string;
  meaning: string;
}

// A short worked calculation: what's given, what's being solved for, and
// the substitution that gets there - never a full problem-solving tutorial,
// just enough to make the formula concrete in one glance.
export interface ConceptExample {
  given: string[];
  calculate: string;
  solution: string;
}

export interface ConceptInfo {
  id: string;
  title: string;
  description: string;
  // Lesson content for the Learn page's concept panel - optional because a
  // genuinely curriculum-only concept (its module has `available: false` AND
  // `optionalLab` unset) has no implemented physics to describe yet, and
  // inventing one here would let the Learn page promise a lesson the game
  // can't back up. Every concept belonging to an `available: true` module, or
  // to an `optionalLab` module whose physics IS implemented (e.g. Gravitation,
  // Waves), must have all four fields set - see hasLesson() below and
  // curriculum.test.ts for the invariant that enforces this.
  formula?: string;
  variables?: ConceptVariable[];
  keyIdea?: string;
  example?: ConceptExample;
}

// Tailwind utility fragments already used by PhysicsJourney/CurriculumMap's
// module cards - centralized here so each module's visual identity (see the
// product design contract) is defined once, alongside the rest of its
// metadata, instead of copied into every component that renders a card.
export interface ModuleTheme {
  accent: string; // gradient stop classes, e.g. "from-blue to-cyan"
  ring: string; // card ring/border color, e.g. "ring-blue/20"
  chip: string; // concept pill background+text, e.g. "bg-blue/10 text-blue-dark"
}

export interface ModuleInfo {
  id: string;
  engineModuleId?: string;
  title: string;
  tagline: string;
  description: string;
  concepts: ConceptInfo[];
  theme: ModuleTheme;
  // Whether /play?module=<id> has an actual, working experience behind it.
  // false means the module exists in the curriculum map (so its place in
  // the learning sequence is real and visible) but has no simulation yet -
  // never render it as playable, and never fabricate placeholder gameplay
  // for it.
  available: boolean;
  // A real, playable-today lab that is deliberately NOT part of the normal
  // adaptive sequence/progression counts (AVAILABLE_MODULES and its derived
  // TOTAL_MODULES/TOTAL_CONCEPTS) - e.g. Gravitation & Orbits, whose game
  // runs its own standalone AdaptiveEngine instance outside MODULE_SEQUENCE
  // (see game-2d/src/adaptiveEngine.ts). Kept as a separate flag from
  // `available` rather than repurposing it, so Play Hub can render it as a
  // normal Physics Lab card (via OPTIONAL_LABS below) without ever inflating
  // the site's adaptive-progression statistics or requiring Learn-page lesson
  // content ahead of the physics. Never true at the same time as `available`.
  optionalLab?: boolean;
}

export const CURRICULUM: ModuleInfo[] = [
  {
    id: "projectile",
    engineModuleId: "projectile_motion",
    title: "Projectile Motion",
    tagline: "Speed • Range • Gravity",
    description: "Launch, predict, and land — explore how speed and gravity shape a trajectory.",
    concepts: [
      {
        id: "speed_range",
        title: "Speed & Range",
        description: "Explore how launch speed affects distance.",
        formula: "R = v² / g",
        variables: [
          { symbol: "R", meaning: "Horizontal range (m)" },
          { symbol: "v", meaning: "Launch speed (m/s)" },
          { symbol: "g", meaning: "Gravitational acceleration (m/s²)" },
        ],
        keyIdea: "At 45°, range grows with the square of launch speed.",
        example: {
          given: ["v = 10 m/s", "g = 10 m/s²"],
          calculate: "R = v² / g",
          solution: "R = 10² / 10 = 10 m",
        },
      },
      {
        id: "gravity_range",
        title: "Gravity & Trajectory",
        description:
          "NEXUS launches at a fixed 45°, where x = v·cos(θ)·t and y = v·sin(θ)·t − ½gt² trace the flight - explore how gravity reshapes that trajectory and its landing range.",
        formula: "x = v·cos(θ)·t\ny = v·sin(θ)·t − ½gt²\n\nR = v² / g",
        variables: [
          { symbol: "R", meaning: "Horizontal range (m)" },
          { symbol: "v", meaning: "Launch speed (m/s)" },
          { symbol: "g", meaning: "Gravitational acceleration (m/s²)" },
        ],
        keyIdea: "Increasing gravity reduces range for the same launch speed.",
        example: {
          given: ["v = 10 m/s", "target R = 10 m"],
          calculate: "g = v² / R",
          solution: "g = 10² / 10 = 10 m/s²",
        },
      },
    ],
    theme: { accent: "from-blue to-cyan", ring: "ring-blue/20", chip: "bg-blue/10 text-blue-dark" },
    available: true,
  },
  {
    id: "newton",
    engineModuleId: "newtons_laws",
    title: "Newton's Laws",
    tagline: "Force • Acceleration • Friction",
    description: "Push a cart, balance forces, and see Newton's Second Law respond in real time.",
    concepts: [
      {
        id: "force_acceleration",
        title: "Force & Acceleration",
        description: "Explore how applied force and mass determine acceleration.",
        formula: "F_net = ma",
        variables: [
          { symbol: "F_net", meaning: "Net force (N)" },
          { symbol: "m", meaning: "Mass (kg)" },
          { symbol: "a", meaning: "Acceleration (m/s²)" },
        ],
        keyIdea: "For the same mass, greater force produces greater acceleration.",
        example: {
          given: ["m = 2 kg", "F_net = 10 N"],
          calculate: "a = F_net / m",
          solution: "a = 10 / 2 = 5 m/s²",
        },
      },
      {
        id: "net_force",
        title: "Net Force",
        description: "Combine multiple forces acting on an object to find the net force.",
        formula: "F_net = ΣF",
        variables: [
          { symbol: "F_net", meaning: "Net force (N)" },
          { symbol: "ΣF", meaning: "Sum of all forces acting on the object (N)" },
        ],
        keyIdea: "Multiple forces combine into one net force that determines motion.",
        example: {
          given: ["Applied force = 10 N", "Opposing force = 3 N"],
          calculate: "F_net = 10 − 3",
          solution: "F_net = 7 N, then a = F_net / m",
        },
      },
      {
        id: "friction",
        title: "Friction",
        description: "Explore how friction opposes motion and reduces net force.",
        formula: "F_net = F_applied − F_friction",
        variables: [
          { symbol: "F_applied", meaning: "Applied force (N)" },
          { symbol: "F_friction", meaning: "Friction force opposing motion (N)" },
        ],
        keyIdea: "Friction opposes motion, reducing the net force available to accelerate the object.",
        example: {
          given: ["F_applied = 10 N", "F_friction = 3 N"],
          calculate: "F_net = F_applied − F_friction",
          solution: "F_net = 10 − 3 = 7 N",
        },
      },
    ],
    theme: { accent: "from-purple to-blue", ring: "ring-purple/20", chip: "bg-purple/10 text-purple-dark" },
    available: true,
  },
  {
    id: "work-energy",
    engineModuleId: "work_energy",
    title: "Work & Energy",
    tagline: "Work • Kinetic Energy • Energy Transfer",
    description: "Connect force, displacement, and motion through work and kinetic energy.",
    concepts: [
      {
        id: "work",
        title: "Work",
        description: "Explore how applied force and displacement combine to produce work.",
        formula: "W = Fd",
        variables: [
          { symbol: "W", meaning: "Work (J)" },
          { symbol: "F", meaning: "Force (N)" },
          { symbol: "d", meaning: "Displacement (m)" },
        ],
        keyIdea: "Work transfers energy through displacement.",
        example: {
          given: ["F = 5 N", "d = 4 m"],
          calculate: "W = Fd",
          solution: "W = 5 × 4 = 20 J",
        },
      },
      {
        id: "kinetic_energy",
        title: "Kinetic Energy",
        description: "Explore how mass and velocity determine an object's kinetic energy.",
        formula: "KE = ½mv²",
        variables: [
          { symbol: "KE", meaning: "Kinetic energy (J)" },
          { symbol: "m", meaning: "Mass (kg)" },
          { symbol: "v", meaning: "Velocity (m/s)" },
        ],
        keyIdea: "Doubling speed makes kinetic energy four times larger.",
        example: {
          given: ["m = 2 kg", "v = 4 m/s"],
          calculate: "KE = ½mv²",
          solution: "KE = ½ × 2 × 16 = 16 J",
        },
      },
      {
        id: "work_energy_theorem",
        title: "Work-Energy Theorem",
        description: "Connect work and energy: net work equals the change in kinetic energy.",
        formula: "W_net = ΔKE",
        variables: [
          { symbol: "W_net", meaning: "Net work done on the object (J)" },
          { symbol: "ΔKE", meaning: "Change in kinetic energy = KE_final − KE_initial (J)" },
        ],
        keyIdea: "Net work done on an object equals its change in kinetic energy.",
        example: {
          given: ["m = 2 kg", "initial v = 2 m/s", "final v = 4 m/s"],
          calculate: "W_net = ½m(v_final² − v_initial²)",
          solution: "W_net = ½ × 2 × (16 − 4) = 12 J",
        },
      },
    ],
    theme: { accent: "from-gold to-purple", ring: "ring-gold/25", chip: "bg-gold/15 text-gold-dark" },
    available: true,
  },
  // Momentum & Collisions (Phase 2) and Circular Motion (Phase 3) are fully
  // implemented - see game-2d/src/adaptiveEngine.ts's MODULE_MOMENTUM and
  // MODULE_CIRCULAR. Gravitation and Waves below are still `available: false`
  // and have no `engineModuleId` - neither is part of the normal 5-module
  // MODULE_SEQUENCE in adaptiveEngine.ts. Each does have a real, working
  // standalone game and its own AdaptiveEngine instance today, though, so
  // each is exposed instead as an `optionalLab` (see ModuleInfo.optionalLab
  // and OPTIONAL_LABS below) rather than waiting on a future phase that would
  // fold it into the adaptive sequence. Theme colors here are placeholders
  // from the existing palette pending each module's own visual polish pass.
  {
    id: "momentum",
    engineModuleId: "momentum_collisions",
    title: "Momentum & Collisions",
    tagline: "Momentum • Impulse • Conservation",
    description: "Collide two carts and see how momentum transfers and is conserved between them.",
    concepts: [
      {
        id: "momentum",
        title: "Momentum",
        description: "Explore how mass and velocity combine to determine an object's momentum.",
        formula: "p = mv",
        variables: [
          { symbol: "p", meaning: "Momentum (kg·m/s)" },
          { symbol: "m", meaning: "Mass (kg)" },
          { symbol: "v", meaning: "Velocity (m/s)" },
        ],
        keyIdea: "Momentum depends on both mass and velocity.",
        example: {
          given: ["m = 3 kg", "v = 4 m/s"],
          calculate: "p = mv",
          solution: "p = 3 × 4 = 12 kg·m/s",
        },
      },
      {
        id: "impulse",
        title: "Impulse",
        description: "Connect force and time to the change in momentum they produce.",
        formula: "J = Δp = FΔt",
        variables: [
          { symbol: "J", meaning: "Impulse (N·s)" },
          { symbol: "Δp", meaning: "Change in momentum = m(v_final − v_initial)" },
          { symbol: "F", meaning: "Force applied during contact (N)" },
          { symbol: "Δt", meaning: "Contact time (s)" },
        ],
        keyIdea: "Impulse changes momentum.",
        example: {
          given: ["m = 2 kg", "initial velocity = 3 m/s", "final velocity = 7 m/s"],
          calculate: "J = m(v_final − v_initial)",
          solution: "J = 2 × (7 − 3) = 8 N·s",
        },
      },
      {
        id: "conservation_of_momentum",
        title: "Conservation of Momentum",
        description: "See how total momentum is conserved when two objects collide.",
        formula: "m₁u₁ + m₂u₂ = m₁v₁ + m₂v₂",
        variables: [
          { symbol: "m₁, m₂", meaning: "Mass of cart A and cart B (kg)" },
          { symbol: "u₁, u₂", meaning: "Velocities before the collision (m/s)" },
          { symbol: "v₁, v₂", meaning: "Velocities after the collision (m/s)" },
        ],
        keyIdea: "Total momentum remains constant in an isolated collision - the relationship the NEXUS collision experiment is built on.",
        example: {
          given: ["m₁ = 2 kg, u₁ = 4 m/s", "m₂ = 2 kg, u₂ = 0 m/s (at rest)", "carts stick together"],
          calculate: "m₁u₁ + m₂u₂ = (m₁ + m₂)v",
          solution: "2(4) + 2(0) = 4v → v = 2 m/s",
        },
      },
    ],
    theme: { accent: "from-red to-cyan", ring: "ring-red/20", chip: "bg-red/10 text-red" },
    available: true,
  },
  {
    id: "circular-motion",
    engineModuleId: "circular_motion",
    title: "Circular Motion",
    tagline: "Centripetal Force • Acceleration • Speed",
    description: "Spin an object around a track and uncover the force that keeps it turning.",
    concepts: [
      {
        id: "centripetal_force",
        title: "Centripetal Force",
        description: "Explore the force that keeps an object moving along a circular path.",
        formula: "Fc = mv² / r",
        variables: [
          { symbol: "Fc", meaning: "Centripetal force (N)" },
          { symbol: "m", meaning: "Mass (kg)" },
          { symbol: "v", meaning: "Speed (m/s)" },
          { symbol: "r", meaning: "Radius (m)" },
        ],
        keyIdea: "Velocity is tangent; centripetal force points inward - and since speed is squared, doubling it quadruples the force.",
        example: {
          given: ["m = 2 kg", "v = 4 m/s", "r = 2 m"],
          calculate: "Fc = mv² / r",
          solution: "Fc = 2 × 16 / 2 = 16 N",
        },
      },
      {
        id: "centripetal_acceleration",
        title: "Centripetal Acceleration",
        description: "Connect speed and radius to the acceleration that keeps an object turning.",
        formula: "ac = v² / r",
        variables: [
          { symbol: "ac", meaning: "Centripetal acceleration (m/s²)" },
          { symbol: "v", meaning: "Speed (m/s)" },
          { symbol: "r", meaning: "Radius (m)" },
          { symbol: "ω", meaning: "Angular velocity (rad/s), where ac = ω²r" },
        ],
        keyIdea: "Constant speed can still mean changing velocity - direction changes continuously, so acceleration exists even without speeding up.",
        example: {
          given: ["v = 4 m/s", "r = 2 m"],
          calculate: "ac = v² / r",
          solution: "ac = 16 / 2 = 8 m/s²",
        },
      },
      {
        id: "circular_speed",
        title: "Circular Speed",
        description: "Explore how radius and period determine an object's speed around a circle.",
        formula: "v = ωr\nv = 2πr / T",
        variables: [
          { symbol: "v", meaning: "Linear speed (m/s)" },
          { symbol: "ω", meaning: "Angular velocity (rad/s)" },
          { symbol: "r", meaning: "Radius (m)" },
          { symbol: "T", meaning: "Period, where T = 2πr / v (s)" },
        ],
        keyIdea: "Linear speed and angular speed are related by v = ωr.",
        example: {
          given: ["ω = 2 rad/s", "r = 1.5 m"],
          calculate: "v = ωr",
          solution: "v = 2 × 1.5 = 3 m/s",
        },
      },
    ],
    theme: { accent: "from-purple to-cyan", ring: "ring-purple/20", chip: "bg-purple/10 text-purple-dark" },
    available: true,
  },
  {
    id: "gravitation",
    title: "Gravitation & Orbits",
    tagline: "Gravity • Orbits • Escape Velocity",
    description: "Place a satellite in orbit and explore the gravity that holds it there.",
    concepts: [
      {
        id: "gravitational_force",
        title: "Gravitational Force",
        description: "Explore how mass and distance determine the gravitational pull between two bodies.",
        formula: "F = GMm / r²",
        variables: [
          { symbol: "F", meaning: "Gravitational force (N)" },
          { symbol: "G", meaning: "Gravitational constant" },
          { symbol: "M", meaning: "Mass of the central star (kg)" },
          { symbol: "m", meaning: "Mass of the orbiting planet (kg)" },
          { symbol: "r", meaning: "Distance between their centers (m)" },
        ],
        keyIdea: "Gravitational force decreases with the square of distance and provides the inward force that can maintain an orbit.",
        example: {
          given: ["G = 1 (simulation units)", "M = 100 (star mass)", "m = 2 (planet mass)", "r = 10 m"],
          calculate: "F = GMm / r²",
          solution: "F = (1 × 100 × 2) / 10² = 2 N",
        },
      },
      {
        id: "orbital_velocity",
        title: "Orbital Velocity",
        description: "Find the speed needed to keep a satellite in a stable orbit.",
        formula: "v = √(GM / r)",
        variables: [
          { symbol: "v", meaning: "Circular orbital velocity (m/s)" },
          { symbol: "G", meaning: "Gravitational constant" },
          { symbol: "M", meaning: "Mass of the central star (kg)" },
          { symbol: "r", meaning: "Orbital radius (m)" },
        ],
        keyIdea: "At the correct circular orbital velocity, gravity supplies the centripetal force required for a stable circular orbit.",
        example: {
          given: ["G = 1 (simulation units)", "M = 100 (star mass)", "r = 25 m"],
          calculate: "v = √(GM / r)",
          solution: "v = √(100 / 25) = √4 = 2 m/s",
        },
      },
      {
        id: "escape_velocity",
        title: "Escape Velocity",
        description: "Determine the speed needed to escape a planet's gravity entirely.",
        formula: "v = √(2GM / r)",
        variables: [
          { symbol: "v", meaning: "Escape velocity (m/s)" },
          { symbol: "G", meaning: "Gravitational constant" },
          { symbol: "M", meaning: "Mass of the central star (kg)" },
          { symbol: "r", meaning: "Distance from the star's center (m)" },
        ],
        keyIdea: "Escape velocity is the minimum initial speed needed for an object to escape the body's gravitational field without additional propulsion, under the idealized model used here.",
        example: {
          given: ["G = 1 (simulation units)", "M = 50 (star mass)", "r = 25 m"],
          calculate: "v = √(2GM / r)",
          solution: "v = √(2 × 50 / 25) = √4 = 2 m/s",
        },
      },
    ],
    theme: { accent: "from-blue to-purple", ring: "ring-blue/20", chip: "bg-blue/10 text-blue-dark" },
    available: false,
    // A real, working game exists (see game-2d/src/GravitationChallengeScene)
    // but its AdaptiveEngine runs standalone, outside MODULE_SEQUENCE - it
    // is intentionally not part of the normal adaptive journey, so it's
    // exposed as an optional lab rather than flipping `available`. Its three
    // concepts DO have full Learn-page lesson content (formula/variables/
    // keyIdea/example, using the same simulation-scale G=1 terminology as
    // GravitationFormulaCard in-game) despite `available: false` - see
    // hasLesson() and curriculum.test.ts's "optional labs" describe block for
    // why that's the deliberate exception, not an oversight: Gravitation's
    // physics (and, below, Wave Motion's) is fully implemented, even though
    // neither is part of the normal adaptive sequence.
    optionalLab: true,
  },
  {
    id: "waves",
    title: "Wave Motion",
    tagline: "Amplitude • Frequency • Wave Speed",
    description: "Generate a wave and connect its amplitude, frequency, and speed.",
    concepts: [
      {
        id: "amplitude",
        title: "Amplitude / Wave Properties",
        description: "Explore how amplitude relates to a wave's energy and displacement.",
        formula: "y(x,t) = A sin(kx − ωt + φ)",
        variables: [
          { symbol: "y", meaning: "Displacement from equilibrium (m)" },
          { symbol: "A", meaning: "Amplitude - the maximum displacement (m)" },
          { symbol: "k", meaning: "Wave number (rad/m)" },
          { symbol: "ω", meaning: "Angular frequency (rad/s)" },
          { symbol: "φ", meaning: "Phase offset (rad)" },
        ],
        keyIdea: "Amplitude is the wave's maximum displacement from equilibrium, read directly off the peak of the curve - it sets the wave's energy but never affects its frequency, wavelength, or speed.",
        example: {
          given: ["A = 1.2 m"],
          calculate: "y_max = A",
          solution: "y_max = 1.2 m - the curve peaks 1.2 m above equilibrium.",
        },
      },
      {
        id: "frequency_wavelength",
        title: "Frequency & Wavelength",
        description: "Connect a wave's frequency and wavelength through its speed.",
        formula: "f = 1 / T",
        variables: [
          { symbol: "f", meaning: "Frequency (Hz)" },
          { symbol: "T", meaning: "Period - time for one full oscillation (s)" },
          { symbol: "λ", meaning: "Wavelength - distance between successive crests (m)" },
        ],
        keyIdea: "Frequency and period are reciprocals of each other, while wavelength is measured directly as the distance between two successive crests.",
        example: {
          given: ["T = 0.5 s"],
          calculate: "f = 1 / T",
          solution: "f = 1 / 0.5 = 2 Hz",
        },
      },
      {
        id: "wave_speed",
        title: "Wave Speed",
        description: "Explore how wave speed relates to frequency and wavelength.",
        formula: "v = fλ",
        variables: [
          { symbol: "v", meaning: "Wave speed (m/s)" },
          { symbol: "f", meaning: "Frequency (Hz)" },
          { symbol: "λ", meaning: "Wavelength (m)" },
        ],
        keyIdea: "Wave speed is the product of frequency and wavelength - for a fixed speed, raising the frequency lowers the wavelength, and vice versa.",
        example: {
          given: ["f = 2 Hz", "λ = 1.5 m"],
          calculate: "v = fλ",
          solution: "v = 2 × 1.5 = 3 m/s",
        },
      },
      {
        id: "superposition",
        title: "Superposition / Interference",
        description: "See how overlapping waves combine through superposition and interference.",
        formula: "y = y₁ + y₂",
        variables: [
          { symbol: "y", meaning: "Resultant displacement (m)" },
          { symbol: "y₁, y₂", meaning: "Displacement of each individual wave (m)" },
        ],
        keyIdea: "Overlapping waves simply add their displacements: matching phase gives full constructive reinforcement (amplitudes add), while a phase difference of π gives full destructive cancellation (amplitudes subtract).",
        example: {
          given: ["A₁ = 1 m", "A₂ = 0.7 m", "phase difference = 0 (constructive)"],
          calculate: "A_total = √(A₁² + A₂² + 2A₁A₂cos(Δφ))",
          solution: "A_total = √(1 + 0.49 + 1.4) = √2.89 = 1.7 m",
        },
      },
    ],
    theme: { accent: "from-cyan to-purple", ring: "ring-cyan/20", chip: "bg-cyan/10 text-blue-dark" },
    available: false,
    // Same optional-lab pattern as Gravitation above: a real, working game
    // exists (game-2d/src/WavesChallengeScene, wired to its own standalone
    // `new AdaptiveEngine(MODULE_WAVES)` instance - see adaptiveEngine.ts's
    // MODULE_WAVES and wavesLearning.ts's recordWaveAttempt), so this is
    // exposed as a Physics Lab rather than left waiting on a future phase
    // that would fold it into the normal 5-module adaptive sequence. Its 4
    // concepts get full Learn-page lesson content for the same reason
    // Gravitation's do - see hasLesson() and curriculum.test.ts's "optional
    // labs" describe block.
    optionalLab: true,
  },
];

// The modules that make up the normal adaptive sequence - what the Learn
// page's curriculum map should render, and what the "N Core Concepts" stat
// should count. Deliberately excludes curriculum-only entries so the site
// never overstates what NEXUS's adaptive engine can do today.
export const AVAILABLE_MODULES: ModuleInfo[] = CURRICULUM.filter((m) => m.available);

export const TOTAL_CONCEPTS = AVAILABLE_MODULES.reduce((sum, m) => sum + m.concepts.length, 0);
export const TOTAL_MODULES = AVAILABLE_MODULES.length;

// Real, playable labs that sit outside the normal adaptive sequence (see
// ModuleInfo.optionalLab) - never included in AVAILABLE_MODULES or its
// derived TOTAL_MODULES/TOTAL_CONCEPTS, so the dashboard's adaptive-progress
// statistics never change just because an optional lab exists. Play Hub's
// "Physics Labs" grid renders these alongside AVAILABLE_MODULES as normal
// lab cards (see PlayHub.tsx's PHYSICS_LAB_MODULES).
export const OPTIONAL_LABS: ModuleInfo[] = CURRICULUM.filter((m) => m.optionalLab);

// The total count of real, playable lab cards across the whole product -
// AVAILABLE_MODULES (the 5-module adaptive sequence) plus OPTIONAL_LABS
// (real games outside it, e.g. Gravitation & Orbits). This is what the
// dashboard's "N Physics Labs" headline/stat should count - deliberately
// kept separate from TOTAL_MODULES, which stays scoped to the adaptive
// sequence alone and must never be inflated by an optional lab.
export const TOTAL_PHYSICS_LABS = AVAILABLE_MODULES.length + OPTIONAL_LABS.length;

export function moduleById(id: string): ModuleInfo | undefined {
  return CURRICULUM.find((m) => m.id === id);
}

// Reverse of engineModuleIdFor: looks a module up by the AdaptiveEngine's
// internal module id (e.g. "projectile_motion") rather than the stable
// curriculum slug - useful wherever a caller only has what the engine/game
// itself reports (GameCanvas's onChallengeStarted, a learning event's
// `module` field) and needs the display metadata for it.
export function moduleByEngineId(engineModuleId: string): ModuleInfo | undefined {
  return CURRICULUM.find((m) => m.engineModuleId === engineModuleId);
}

// The AdaptiveEngine module id a stable curriculum id maps to, or undefined
// if that module (or the id itself) has no engine behind it yet. This is
// the one place that bridges the two id vocabularies - callers (routing,
// etc.) should never hardcode their own copy of this mapping.
export function engineModuleIdFor(id: string): string | undefined {
  return moduleById(id)?.engineModuleId;
}

// Whether a concept has full Learn-page lesson content - true for every
// concept in an `available: true` module, always false for a curriculum-only
// module's concepts (see ConceptInfo's doc comment). The Learn page uses
// this, not `module.available` directly, to decide whether a concept row is
// clickable, so a concept can never open a lesson panel promising content
// that isn't actually there.
export function hasLesson(concept: ConceptInfo): boolean {
  return Boolean(concept.formula && concept.variables && concept.keyIdea && concept.example);
}

// The /play destination for a concept's "Try This" button, or undefined if
// its module has no working game to route to yet. Deliberately module-only
// (no ?concept= param) - GameCanvas's AdaptiveEngine always starts a module
// at its own first concept, so a concept-specific route would be a promise
// the current engine architecture can't keep. An optional lab (available is
// false, but it has a real standalone game - see ModuleInfo.optionalLab)
// gets a route too, since /play?module=<id> genuinely opens something.
export function playRouteFor(moduleId: string): string | undefined {
  const mod = moduleById(moduleId);
  return mod && (mod.available || mod.optionalLab) ? `/play?module=${mod.id}` : undefined;
}
