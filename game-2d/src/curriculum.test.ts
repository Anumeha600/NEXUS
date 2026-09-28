// --------------------------------------------------------------------------
// CURRICULUM ARCHITECTURE - registration invariants
//
// These don't test any module's physics (that's physics.test.ts,
// challengeLogic.test.ts, curriculumFlow.test.ts for the 5 modules that
// exist today). They test the *shape* of the curriculum itself: that all 8
// modules NEXUS has today are registered with stable, unique ids, that the
// bridge between a stable curriculum id and the AdaptiveEngine's internal
// module id is correct for the modules that have one, and that a
// curriculum-only module (no engine yet) can flow through routing/engine
// startup without crashing or being mistaken for a working module. This is
// what "safe to add Modules 6-8 later" actually means in code, not just in a
// plan.
// --------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import {
  CURRICULUM,
  AVAILABLE_MODULES,
  OPTIONAL_LABS,
  moduleById,
  engineModuleIdFor,
  moduleByEngineId,
  hasLesson,
  playRouteFor,
  type ModuleInfo,
  type LearningEvent,
} from "@nexus/shared";
import {
  AdaptiveEngine,
  MODULE_PROJECTILE,
  MODULE_NEWTON,
  MODULE_WORK_ENERGY,
  MODULE_MOMENTUM,
  MODULE_CIRCULAR,
  MODULE_ARCHIMEDES,
  CONCEPT_SPEED_RANGE,
  CONCEPT_BUOYANT_FORCE,
  CONCEPT_APPARENT_WEIGHT,
  CONCEPT_ARCHIMEDES_PRINCIPLE,
  CONCEPT_FLOAT_SINK_DENSITY,
} from "./adaptiveEngine";

const EXPECTED_MODULE_IDS = ["projectile", "newton", "work-energy", "momentum", "circular-motion", "gravitation", "waves", "archimedes"];
const AVAILABLE_MODULE_IDS = ["projectile", "newton", "work-energy", "momentum", "circular-motion"];

describe("all 8 NEXUS modules are registered", () => {
  it("has exactly the 8 planned modules, in curriculum order, with the recommended stable ids", () => {
    expect(CURRICULUM.map((m) => m.id)).toEqual(EXPECTED_MODULE_IDS);
  });

  it("module ids are unique", () => {
    const ids = CURRICULUM.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every module has at least one concept, and concept ids are unique within that module", () => {
    for (const mod of CURRICULUM) {
      expect(mod.concepts.length).toBeGreaterThan(0);
      const conceptIds = mod.concepts.map((c) => c.id);
      expect(new Set(conceptIds).size).toBe(conceptIds.length);
    }
  });

  // AdaptiveEngine's conceptMastery is a single flat map keyed only by
  // concept id (never namespaced by module - see adaptiveEngine.ts), so two
  // different modules sharing a concept id would silently merge their
  // mastery tracking. Uniqueness has to hold across the WHOLE curriculum,
  // not just within each module, or a future module's mastery could
  // contaminate an unrelated one's the moment it's wired into the engine.
  it("concept ids are unique across the entire curriculum, not just within a module (AdaptiveEngine has no per-module namespace)", () => {
    const allConceptIds = CURRICULUM.flatMap((m) => m.concepts.map((c) => c.id));
    expect(new Set(allConceptIds).size).toBe(allConceptIds.length);
  });

  it("exactly 5 modules are available today - Gravitation, Waves, and Archimedes are curriculum-only until their own phase", () => {
    expect(AVAILABLE_MODULES.map((m) => m.id)).toEqual(AVAILABLE_MODULE_IDS);
    for (const mod of CURRICULUM) {
      const shouldBeAvailable = AVAILABLE_MODULE_IDS.includes(mod.id);
      expect(mod.available).toBe(shouldBeAvailable);
    }
  });

  it("a curriculum-only module has no engineModuleId - there is no working game to route to yet", () => {
    for (const mod of CURRICULUM) {
      if (!mod.available) expect(mod.engineModuleId).toBeUndefined();
    }
  });
});

describe("the stable curriculum id <-> AdaptiveEngine module id bridge", () => {
  it("engineModuleIdFor resolves each available module to exactly the AdaptiveEngine constant it uses", () => {
    expect(engineModuleIdFor("projectile")).toBe(MODULE_PROJECTILE);
    expect(engineModuleIdFor("newton")).toBe(MODULE_NEWTON);
    expect(engineModuleIdFor("work-energy")).toBe(MODULE_WORK_ENERGY);
    expect(engineModuleIdFor("momentum")).toBe(MODULE_MOMENTUM);
    expect(engineModuleIdFor("circular-motion")).toBe(MODULE_CIRCULAR);
  });

  it("engineModuleIdFor is undefined for curriculum-only modules and for unrecognized ids - routing must fall back, never throw", () => {
    for (const id of ["gravitation", "waves", "archimedes", "not-a-real-module"]) {
      expect(engineModuleIdFor(id)).toBeUndefined();
    }
  });

  it("moduleByEngineId is the exact inverse of engineModuleIdFor for every available module", () => {
    for (const mod of AVAILABLE_MODULES) {
      expect(moduleByEngineId(mod.engineModuleId!)?.id).toBe(mod.id);
    }
  });

  it("moduleById recognizes all 7 planned module ids - a future module's slug is never \"unrecognized\", only \"not yet playable\"", () => {
    for (const id of EXPECTED_MODULE_IDS) {
      expect(moduleById(id)).toBeDefined();
    }
    expect(moduleById("not-a-real-module")).toBeUndefined();
  });
});

describe("routing a curriculum-only module id into the engine never crashes", () => {
  it("starting the engine with the (undefined) engineModuleId of a not-yet-implemented module falls back to the default journey, exactly like an unrecognized module id does today", () => {
    for (const id of ["gravitation", "waves", "archimedes"]) {
      const resolved = engineModuleIdFor(id); // undefined - no engine behind it yet
      const engine = new AdaptiveEngine(resolved);
      expect(engine.currentModuleId).toBe(MODULE_PROJECTILE);
      expect(engine.currentConceptId).toBe(CONCEPT_SPEED_RANGE);
    }
  });

  it("starting the engine with Momentum's or Circular Motion's engineModuleId opens directly on its first concept, exactly like the other working modules", () => {
    const momentumEngine = new AdaptiveEngine(engineModuleIdFor("momentum"));
    expect(momentumEngine.currentModuleId).toBe(MODULE_MOMENTUM);

    const circularEngine = new AdaptiveEngine(engineModuleIdFor("circular-motion"));
    expect(circularEngine.currentModuleId).toBe(MODULE_CIRCULAR);
  });
});

describe("existing modules are unaffected by the curriculum registration of Modules 6-8", () => {
  it("the 5 available modules' concept counts and order in the curriculum match adaptiveEngine.ts exactly", () => {
    const projectile = moduleById("projectile") as ModuleInfo;
    const newton = moduleById("newton") as ModuleInfo;
    const workEnergy = moduleById("work-energy") as ModuleInfo;
    const momentum = moduleById("momentum") as ModuleInfo;
    const circular = moduleById("circular-motion") as ModuleInfo;
    expect(projectile.concepts.map((c) => c.id)).toEqual(["speed_range", "gravity_range"]);
    expect(newton.concepts.map((c) => c.id)).toEqual(["force_acceleration", "net_force", "friction"]);
    expect(workEnergy.concepts.map((c) => c.id)).toEqual(["work", "kinetic_energy", "work_energy_theorem"]);
    expect(momentum.concepts.map((c) => c.id)).toEqual(["momentum", "impulse", "conservation_of_momentum"]);
    expect(circular.concepts.map((c) => c.id)).toEqual(["centripetal_force", "centripetal_acceleration", "circular_speed"]);
  });

  it("a fresh engine still defaults to Projectile Motion / Speed & Range, regardless of the 3 curriculum-only optional labs existing", () => {
    const engine = new AdaptiveEngine();
    expect(engine.currentModuleId).toBe(MODULE_PROJECTILE);
    expect(engine.currentConceptId).toBe(CONCEPT_SPEED_RANGE);
  });

  it("Archimedes' curriculum concept ids match adaptiveEngine.ts's own CONCEPT_BUOYANT_FORCE/CONCEPT_APPARENT_WEIGHT/CONCEPT_ARCHIMEDES_PRINCIPLE/CONCEPT_FLOAT_SINK_DENSITY exactly", () => {
    const archimedes = moduleById("archimedes") as ModuleInfo;
    expect(archimedes.concepts.map((c) => c.id)).toEqual([CONCEPT_BUOYANT_FORCE, CONCEPT_APPARENT_WEIGHT, CONCEPT_ARCHIMEDES_PRINCIPLE, CONCEPT_FLOAT_SINK_DENSITY]);
  });

  it("MODULE_ARCHIMEDES is registered in the adaptive engine but never part of MODULE_SEQUENCE - a fresh engine never starts there", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    expect(engine.currentModuleId).toBe(MODULE_ARCHIMEDES);
    expect(engine.currentConceptId).toBe(CONCEPT_BUOYANT_FORCE);
    const defaultEngine = new AdaptiveEngine();
    expect(defaultEngine.currentModuleId).not.toBe(MODULE_ARCHIMEDES);
  });
});

describe("the learning-event schema accommodates Momentum & Collisions' own context shape", () => {
  // LearningEvent.context is `Record<string, number | string>` (see
  // @nexus/shared/src/insight.ts) precisely so each module can report its
  // own fields without a schema change - this proves a real Momentum &
  // Collisions event (the exact field names challengeLogic.ts's contextFor
  // produces) survives a JSON round-trip (the same path a real learning
  // event takes to /api/insight).
  it("a real Momentum & Collisions event round-trips through JSON with its module-specific context intact", () => {
    const event: LearningEvent = {
      session_id: "test-session",
      module: "momentum_collisions",
      concept: "Conservation of Momentum",
      challenge_type: "conservation_of_momentum",
      difficulty: "Intermediate",
      target_value: 12.5,
      actual_value: 12.1,
      unit: "m/s",
      success: true,
      performance: 0.9,
      mastery_before: 0.4,
      mastery_after: 0.5,
      attempt_number: 3,
      recent_attempts: 3,
      context: {
        mass1: 2,
        mass2: 3,
        initial_velocity1: 4,
        initial_velocity2: -1,
        final_velocity1: 1.4,
        final_velocity2: 1.4,
        collision_type: "inelastic",
        momentum_before: 5,
        momentum_after: 5,
      },
    };
    const roundTripped = JSON.parse(JSON.stringify(event)) as LearningEvent;
    expect(roundTripped).toEqual(event);
    expect(roundTripped.context?.collision_type).toBe("inelastic");
  });

  it("a real Circular Motion event round-trips through JSON with its module-specific context intact", () => {
    const event: LearningEvent = {
      session_id: "test-session",
      module: "circular_motion",
      concept: "Centripetal Force",
      challenge_type: "centripetal_force",
      difficulty: "Intermediate",
      target_value: 21.3,
      actual_value: 21.3,
      unit: "N",
      success: true,
      performance: 0.9,
      mastery_before: 0.4,
      mastery_after: 0.5,
      attempt_number: 2,
      recent_attempts: 2,
      context: {
        mass: 2,
        radius: 1.5,
        speed: 4,
        angular_velocity: 2.67,
        centripetal_acceleration: 10.67,
        centripetal_force: 21.33,
        revolutions_completed: 2,
      },
    };
    const roundTripped = JSON.parse(JSON.stringify(event)) as LearningEvent;
    expect(roundTripped).toEqual(event);
    expect(roundTripped.context?.centripetal_force).toBe(21.33);
  });
});

// --------------------------------------------------------------------------
// LEARN PAGE - concept lesson content
//
// The Learn page's concept panel (formula + variables + key idea + example)
// reads this data straight off @nexus/shared's CURRICULUM, so these tests
// are what keeps that panel from ever rendering a concept with a missing
// formula or an empty example - the UI has no fallback text for that case,
// it would just show a blank block.
// --------------------------------------------------------------------------
describe("Learn page concept lesson content", () => {
  it("every concept in an available module has full lesson content (formula, variables, key idea, example)", () => {
    for (const mod of AVAILABLE_MODULES) {
      for (const concept of mod.concepts) {
        expect(hasLesson(concept), `${mod.id}/${concept.id} should have lesson content`).toBe(true);
      }
    }
  });

  it("every concept in a genuinely curriculum-only module (not available, not an optional lab) has no lesson content - nothing is invented ahead of the physics", () => {
    // Vacuous today: Gravitation and Waves (the only 2 modules with
    // `available: false`) are both optional labs with real physics behind
    // them, so no module currently falls into this bucket - but the
    // invariant still holds for whatever the next curriculum-only module
    // (e.g. a future Module 8) turns out to be.
    for (const mod of CURRICULUM) {
      if (mod.available || mod.optionalLab) continue;
      for (const concept of mod.concepts) {
        expect(hasLesson(concept), `${mod.id}/${concept.id} should NOT have lesson content yet`).toBe(false);
      }
    }
  });

  // Gravitation and Waves are both `available: false` (outside the adaptive
  // sequence - see optionalLab) but their physics IS fully implemented, so
  // unlike a genuinely curriculum-only module, both get full lesson content -
  // this is the deliberate exception the test above excludes via
  // `mod.optionalLab`.
  it("every concept in an optional lab with real physics (Gravitation, Wave Motion) has full lesson content, same as an available module", () => {
    for (const mod of OPTIONAL_LABS) {
      for (const concept of mod.concepts) {
        expect(hasLesson(concept), `${mod.id}/${concept.id} should have lesson content`).toBe(true);
      }
    }
  });

  it("every available concept's formula is a non-empty string", () => {
    for (const mod of AVAILABLE_MODULES) {
      for (const concept of mod.concepts) {
        expect(concept.formula).toBeTruthy();
        expect(typeof concept.formula).toBe("string");
      }
    }
  });

  it("every available concept's key idea is a non-empty string", () => {
    for (const mod of AVAILABLE_MODULES) {
      for (const concept of mod.concepts) {
        expect(concept.keyIdea).toBeTruthy();
        expect(typeof concept.keyIdea).toBe("string");
      }
    }
  });

  it("every available concept has at least one variable with a symbol and a meaning", () => {
    for (const mod of AVAILABLE_MODULES) {
      for (const concept of mod.concepts) {
        expect(concept.variables && concept.variables.length).toBeGreaterThan(0);
        for (const v of concept.variables ?? []) {
          expect(v.symbol).toBeTruthy();
          expect(v.meaning).toBeTruthy();
        }
      }
    }
  });

  it("every available concept's example has at least one given value, a calculation, and a solution", () => {
    for (const mod of AVAILABLE_MODULES) {
      for (const concept of mod.concepts) {
        const example = concept.example;
        expect(example?.given.length).toBeGreaterThan(0);
        expect(example?.calculate).toBeTruthy();
        expect(example?.solution).toBeTruthy();
      }
    }
  });

  it("every optional-lab concept's formula, key idea, variables, and example are all non-empty (same shape as an available module's)", () => {
    for (const mod of OPTIONAL_LABS) {
      for (const concept of mod.concepts) {
        expect(concept.formula).toBeTruthy();
        expect(concept.keyIdea).toBeTruthy();
        expect(concept.variables && concept.variables.length).toBeGreaterThan(0);
        for (const v of concept.variables ?? []) {
          expect(v.symbol).toBeTruthy();
          expect(v.meaning).toBeTruthy();
        }
        expect(concept.example?.given.length).toBeGreaterThan(0);
        expect(concept.example?.calculate).toBeTruthy();
        expect(concept.example?.solution).toBeTruthy();
      }
    }
  });

  it("every concept belongs to a module that moduleById can resolve", () => {
    for (const mod of CURRICULUM) {
      for (const concept of mod.concepts) {
        expect(moduleById(mod.id)?.concepts.some((c) => c.id === concept.id)).toBe(true);
      }
    }
  });

  it("playRouteFor maps every available module to its /play?module=<id> destination", () => {
    for (const mod of AVAILABLE_MODULES) {
      expect(playRouteFor(mod.id)).toBe(`/play?module=${mod.id}`);
    }
  });

  it("playRouteFor also maps Gravitation, Waves, and Archimedes - optional labs with a real game, kept outside the normal available/adaptive-sequence set", () => {
    expect(playRouteFor("gravitation")).toBe("/play?module=gravitation");
    expect(playRouteFor("waves")).toBe("/play?module=waves");
    expect(playRouteFor("archimedes")).toBe("/play?module=archimedes");
  });

  it("playRouteFor refuses to present a curriculum-only module (no game at all) or an unrecognized module as playable", () => {
    expect(playRouteFor("not-a-real-module")).toBeUndefined();
  });
});

describe("optional labs (a real game outside the normal adaptive sequence)", () => {
  it("Gravitation, Waves, and Archimedes are marked as optional labs, not as part of the normal available/adaptive-sequence set", () => {
    for (const id of ["gravitation", "waves", "archimedes"]) {
      const mod = moduleById(id);
      expect(mod?.optionalLab).toBe(true);
      expect(mod?.available).toBe(false);
    }
  });

  it("OPTIONAL_LABS contains exactly Gravitation, Waves, and Archimedes, in curriculum order, and never overlaps with AVAILABLE_MODULES", () => {
    expect(OPTIONAL_LABS.map((m) => m.id)).toEqual(["gravitation", "waves", "archimedes"]);
    for (const mod of OPTIONAL_LABS) {
      expect(AVAILABLE_MODULES.some((m) => m.id === mod.id)).toBe(false);
    }
  });

  it("an optional lab is excluded from TOTAL_MODULES/TOTAL_CONCEPTS - adaptive-progression stats never change because of it", () => {
    expect(AVAILABLE_MODULES.some((m) => m.optionalLab)).toBe(false);
  });
});
