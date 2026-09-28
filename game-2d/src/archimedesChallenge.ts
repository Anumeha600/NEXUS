// --------------------------------------------------------------------------
// Archimedes / Buoyancy - challenge model, Phase 1.
//
// Deliberately self-contained, mirroring wavesChallenge.ts's own Phase 1
// header note: this does NOT read from or generate an adaptiveEngine.ts
// Challenge, and AdaptiveEngine wiring is out of scope for this phase. Every
// challenge here is a plain, deterministic ArchimedesChallenge produced by
// generateArchimedesChallenge(conceptId, variant) - same variant always
// produces the same challenge, so the whole flow (generate -> answer ->
// evaluate) is unit-testable with no mocking.
//
// The player-facing interaction is always the same physical sequence -
// measure the object's weight in air, lower it into the fluid, then measure
// its apparent weight - modeled below as an explicit READY / MEASURING_AIR /
// MEASURING_WATER / RESULT state machine (the same "small explicit phase
// state machine" shape as gravitationChallenge.ts's own GravitationPlayState,
// not a second, differently-shaped architecture). What differs between the 5
// challenge types is only which of the resulting quantities is given to the
// player and which one they must find - never a different interaction flow.
// --------------------------------------------------------------------------

import {
  EARTH_GRAVITY,
  weightFromMass,
  buoyantForce,
  apparentWeight,
  displacedVolumeForSubmergedObject,
  floatingOutcome,
  type FloatingOutcome,
} from "./archimedesPhysics";

export const ARCHIMEDES_CONCEPT_BUOYANT_FORCE = "buoyant_force" as const;
export const ARCHIMEDES_CONCEPT_APPARENT_WEIGHT = "apparent_weight" as const;
export const ARCHIMEDES_CONCEPT_DISPLACED_VOLUME = "displaced_volume" as const;
export const ARCHIMEDES_CONCEPT_FLUID_DENSITY = "fluid_density" as const;
export const ARCHIMEDES_CONCEPT_FLOAT_SINK = "float_sink" as const;

export type ArchimedesConceptId =
  | typeof ARCHIMEDES_CONCEPT_BUOYANT_FORCE
  | typeof ARCHIMEDES_CONCEPT_APPARENT_WEIGHT
  | typeof ARCHIMEDES_CONCEPT_DISPLACED_VOLUME
  | typeof ARCHIMEDES_CONCEPT_FLUID_DENSITY
  | typeof ARCHIMEDES_CONCEPT_FLOAT_SINK;

export const ARCHIMEDES_CONCEPTS: readonly { id: ArchimedesConceptId; title: string }[] = [
  { id: ARCHIMEDES_CONCEPT_BUOYANT_FORCE, title: "Buoyant Force" },
  { id: ARCHIMEDES_CONCEPT_APPARENT_WEIGHT, title: "Apparent Weight" },
  { id: ARCHIMEDES_CONCEPT_DISPLACED_VOLUME, title: "Displaced Volume" },
  { id: ARCHIMEDES_CONCEPT_FLUID_DENSITY, title: "Fluid Density" },
  { id: ARCHIMEDES_CONCEPT_FLOAT_SINK, title: "Float / Sink" },
];

export type ArchimedesSolveTarget = "buoyantForce" | "apparentWeight" | "displacedVolume" | "fluidDensity";

// The object/fluid parameters behind every challenge - always fully
// determined (never partially hidden the way wavesChallenge.ts's inverse
// wave-speed problems hide one field), since the scene always needs a
// complete, coherent physical object to actually render and animate. What a
// given challenge type withholds from the PLAYER is a presentational
// decision (see givenFieldsForArchimedesChallenge below), never a gap in the
// underlying physics.
export interface ArchimedesObjectSetup {
  readonly mass: number; // kg
  readonly objectVolume: number; // m^3 - the object's own total volume
  readonly fluidDensity: number; // kg/m^3
  readonly fluidName: string;
  readonly gravity: number; // m/s^2
}

export interface ArchimedesNumericChallenge {
  readonly kind: "numeric";
  readonly id: number;
  readonly conceptId: ArchimedesConceptId;
  readonly conceptTitle: string;
  readonly prompt: string;
  readonly unit: string;
  readonly solveFor: ArchimedesSolveTarget;
  readonly setup: ArchimedesObjectSetup;
  // The true, physically consistent values for this setup, fully submerged -
  // every numeric challenge type is a "given a subset of these, find the
  // rest" question over this SAME fixed physical state, never a
  // type-specific recomputation.
  readonly actualWeight: number; // N - W = mg, measured in air
  readonly apparentWeight: number; // N - measured fully submerged
  readonly displacedVolume: number; // m^3 - equals objectVolume, fully submerged
  readonly buoyantForce: number; // N
  readonly targetValue: number; // whichever of the 4 fields above solveFor names
  readonly tolerance: number;
}

export interface ArchimedesChoiceChallenge {
  readonly kind: "choice";
  readonly id: number;
  readonly conceptId: typeof ARCHIMEDES_CONCEPT_FLOAT_SINK;
  readonly conceptTitle: string;
  readonly prompt: string;
  readonly solveFor: "floatingOutcome";
  readonly setup: ArchimedesObjectSetup;
  readonly objectDensity: number; // kg/m^3
  readonly options: readonly FloatingOutcome[];
  readonly correctAnswer: FloatingOutcome;
}

export type ArchimedesChallenge = ArchimedesNumericChallenge | ArchimedesChoiceChallenge;

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

// A small set of real, named fluids (not just "fluid density N") so the lab
// feels concrete - cycled by variant, same spirit as wavesChallenge.ts's
// variantScale but for a discrete choice rather than a continuous scale.
//
// `name` is the lowercase form used inline in sentence prompts ("submerged in
// salt water"); `label` is the Title Case form for UI chrome like a fluid
// picker. Exported as ARCHIMEDES_FLUIDS below so a fluid-selection control
// reads from this single source of truth rather than duplicating the list.
export interface ArchimedesFluid {
  readonly name: string;
  readonly label: string;
  readonly density: number;
}

const FLUIDS: readonly ArchimedesFluid[] = [
  { name: "water", label: "Water", density: 1000 },
  { name: "salt water", label: "Salt Water", density: 1025 },
  { name: "olive oil", label: "Olive Oil", density: 920 },
  { name: "glycerin", label: "Glycerin", density: 1260 },
];

export const ARCHIMEDES_FLUIDS: readonly ArchimedesFluid[] = FLUIDS;

// Small, deterministic per-variant scaling - no Math.random anywhere in this
// module (matching wavesChallenge.ts's own convention), so the exact same
// (conceptId, variant) pair always reproduces the exact same challenge.
function variantScale(variant: number): number {
  return 1 + (variant % 4) * 0.25;
}

let nextChallengeId = 1;

// The shared physical state every numeric challenge type is built from - one
// real, fully-determined object fully submerged in one real fluid. Educational
// ranges only (single-digit kg, sub-0.01 m^3 volumes) - never absurd values.
function baseSetupFor(variant: number): ArchimedesObjectSetup {
  const scale = variantScale(variant);
  const fluid = FLUIDS[variant % FLUIDS.length];
  return {
    mass: round2(1.5 * scale), // 1.5 kg .. 3.375 kg
    objectVolume: round4(0.0012 * scale), // 0.0012 m^3 .. 0.0027 m^3
    fluidDensity: fluid.density,
    fluidName: fluid.name,
    gravity: EARTH_GRAVITY,
  };
}

interface DerivedState {
  readonly actualWeight: number;
  readonly displacedVolume: number;
  readonly buoyantForceValue: number;
  readonly apparentWeightValue: number;
}

// Derives every physically-real quantity for a fully-submerged setup exactly
// once, from archimedesPhysics.ts's own functions - every challenge
// generator below reads from this instead of re-deriving any of it
// independently.
function deriveState(setup: ArchimedesObjectSetup): DerivedState {
  const actualWeight = round2(weightFromMass(setup.mass, setup.gravity));
  const displacedVolume = displacedVolumeForSubmergedObject(setup.objectVolume);
  const buoyantForceValue = round2(buoyantForce(setup.fluidDensity, setup.gravity, displacedVolume));
  const apparentWeightValue = round2(apparentWeight(actualWeight, buoyantForceValue));
  return { actualWeight, displacedVolume, buoyantForceValue, apparentWeightValue };
}

// --------------------------------------------------------------------------
// Prompt builders - one per numeric concept, each a pure function of
// (setup, derived). Used both by the generate*Challenge functions below and
// by applyFluidToChallenge further down, so a fluid change re-renders the
// exact same prompt template a freshly-generated challenge would use -
// never a second, hand-duplicated copy of this text that could drift.
// --------------------------------------------------------------------------

function buoyantForcePrompt(setup: ArchimedesObjectSetup, derived: DerivedState): string {
  return `In air, the spring balance reads ${derived.actualWeight} N. Fully submerged in ${setup.fluidName}, it reads ${derived.apparentWeightValue} N. What is the buoyant force?`;
}

function apparentWeightPrompt(setup: ArchimedesObjectSetup, derived: DerivedState): string {
  return `A ${setup.mass} kg object (volume ${setup.objectVolume} m³) is fully submerged in ${setup.fluidName} (density ${setup.fluidDensity} kg/m³). What will the spring balance read?`;
}

function displacedVolumePrompt(setup: ArchimedesObjectSetup, derived: DerivedState): string {
  return `Submerged in ${setup.fluidName} (density ${setup.fluidDensity} kg/m³), the object experiences a buoyant force of ${derived.buoyantForceValue} N. What volume of fluid does it displace?`;
}

function fluidDensityPrompt(setup: ArchimedesObjectSetup, derived: DerivedState): string {
  return `Submerged, the object displaces ${derived.displacedVolume} m³ of fluid and experiences a buoyant force of ${derived.buoyantForceValue} N. What is the fluid's density?`;
}

function floatSinkPrompt(fluid: { name: string; density: number }, objectDensity: number): string {
  return `This object has a density of ${objectDensity} kg/m³. Lowered into ${fluid.name} (density ${fluid.density} kg/m³), will it float, sink, or stay neutrally suspended?`;
}

// --------------------------------------------------------------------------
// Challenge type 1: Buoyant Force - given the weight measured in air and the
// apparent weight measured submerged, find the buoyant force.
// --------------------------------------------------------------------------

function generateBuoyantForceChallenge(variant: number): ArchimedesNumericChallenge {
  const setup = baseSetupFor(variant);
  const derived = deriveState(setup);
  return {
    kind: "numeric",
    id: nextChallengeId++,
    conceptId: ARCHIMEDES_CONCEPT_BUOYANT_FORCE,
    conceptTitle: "Buoyant Force",
    prompt: buoyantForcePrompt(setup, derived),
    unit: "N",
    solveFor: "buoyantForce",
    setup,
    actualWeight: derived.actualWeight,
    apparentWeight: derived.apparentWeightValue,
    displacedVolume: derived.displacedVolume,
    buoyantForce: derived.buoyantForceValue,
    targetValue: derived.buoyantForceValue,
    tolerance: 0.3,
  };
}

// --------------------------------------------------------------------------
// Challenge type 2: Apparent Weight - given mass, fluid density and
// displaced volume, find what the balance will read once submerged.
// --------------------------------------------------------------------------

function generateApparentWeightChallenge(variant: number): ArchimedesNumericChallenge {
  const setup = baseSetupFor(variant);
  const derived = deriveState(setup);
  return {
    kind: "numeric",
    id: nextChallengeId++,
    conceptId: ARCHIMEDES_CONCEPT_APPARENT_WEIGHT,
    conceptTitle: "Apparent Weight",
    prompt: apparentWeightPrompt(setup, derived),
    unit: "N",
    solveFor: "apparentWeight",
    setup,
    actualWeight: derived.actualWeight,
    apparentWeight: derived.apparentWeightValue,
    displacedVolume: derived.displacedVolume,
    buoyantForce: derived.buoyantForceValue,
    targetValue: derived.apparentWeightValue,
    tolerance: 0.3,
  };
}

// --------------------------------------------------------------------------
// Challenge type 3: Displaced Volume - given the buoyant force and the
// fluid's density, find the volume of fluid displaced.
// --------------------------------------------------------------------------

function generateDisplacedVolumeChallenge(variant: number): ArchimedesNumericChallenge {
  const setup = baseSetupFor(variant);
  const derived = deriveState(setup);
  return {
    kind: "numeric",
    id: nextChallengeId++,
    conceptId: ARCHIMEDES_CONCEPT_DISPLACED_VOLUME,
    conceptTitle: "Displaced Volume",
    prompt: displacedVolumePrompt(setup, derived),
    unit: "m³",
    solveFor: "displacedVolume",
    setup,
    actualWeight: derived.actualWeight,
    apparentWeight: derived.apparentWeightValue,
    displacedVolume: derived.displacedVolume,
    buoyantForce: derived.buoyantForceValue,
    targetValue: derived.displacedVolume,
    tolerance: 0.0002,
  };
}

// --------------------------------------------------------------------------
// Challenge type 4: Fluid Density - given the buoyant force and the
// displaced volume, find the fluid's density.
// --------------------------------------------------------------------------

function generateFluidDensityChallenge(variant: number): ArchimedesNumericChallenge {
  const setup = baseSetupFor(variant);
  const derived = deriveState(setup);
  return {
    kind: "numeric",
    id: nextChallengeId++,
    conceptId: ARCHIMEDES_CONCEPT_FLUID_DENSITY,
    conceptTitle: "Fluid Density",
    prompt: fluidDensityPrompt(setup, derived),
    unit: "kg/m³",
    solveFor: "fluidDensity",
    setup,
    actualWeight: derived.actualWeight,
    apparentWeight: derived.apparentWeightValue,
    displacedVolume: derived.displacedVolume,
    buoyantForce: derived.buoyantForceValue,
    targetValue: setup.fluidDensity,
    tolerance: 15,
  };
}

// --------------------------------------------------------------------------
// Challenge type 5: Float / Sink - given the object's own density and the
// fluid's density, predict whether it floats, sinks, or is neutrally
// buoyant. objectDensity is computed FIRST and used directly for
// classification (never re-derived from a separately-rounded mass/volume
// pair), so the displayed density and the correct answer can never drift
// apart due to rounding.
// --------------------------------------------------------------------------

function generateFloatSinkChallenge(variant: number): ArchimedesChoiceChallenge {
  const scale = variantScale(variant);
  const fluid = FLUIDS[variant % FLUIDS.length];
  const objectVolume = round4(0.0012 * scale);
  // Cycles through a floating case, a sinking case, and an exactly-neutral
  // case, in addition to the fluid varying by variant - a genuinely
  // different object relative to a genuinely different fluid each time.
  const subtype = variant % 3;
  const densityRatio = subtype === 0 ? 0.6 : subtype === 1 ? 1.4 : 1;
  const objectDensity = round2(fluid.density * densityRatio);
  const mass = round4(objectDensity * objectVolume);
  const setup: ArchimedesObjectSetup = { mass, objectVolume, fluidDensity: fluid.density, fluidName: fluid.name, gravity: EARTH_GRAVITY };
  const correctAnswer = floatingOutcome(objectDensity, fluid.density);
  return {
    kind: "choice",
    id: nextChallengeId++,
    conceptId: ARCHIMEDES_CONCEPT_FLOAT_SINK,
    conceptTitle: "Float / Sink",
    prompt: floatSinkPrompt(fluid, objectDensity),
    solveFor: "floatingOutcome",
    setup,
    objectDensity,
    options: ["FLOAT", "SINK", "NEUTRAL"],
    correctAnswer,
  };
}

// The single entry point: dispatches on conceptId, cycling through a small
// set of deterministic variants - never a random challenge, so (conceptId,
// variant) always reproduces the exact same ArchimedesChallenge.
export function generateArchimedesChallenge(conceptId: ArchimedesConceptId, variant = 0): ArchimedesChallenge {
  if (conceptId === ARCHIMEDES_CONCEPT_BUOYANT_FORCE) return generateBuoyantForceChallenge(variant);
  if (conceptId === ARCHIMEDES_CONCEPT_APPARENT_WEIGHT) return generateApparentWeightChallenge(variant);
  if (conceptId === ARCHIMEDES_CONCEPT_DISPLACED_VOLUME) return generateDisplacedVolumeChallenge(variant);
  if (conceptId === ARCHIMEDES_CONCEPT_FLUID_DENSITY) return generateFluidDensityChallenge(variant);
  return generateFloatSinkChallenge(variant);
}

// --------------------------------------------------------------------------
// Manual fluid selection - re-derives a challenge's physically-consistent
// fields (setup, prompt, and every quantity that depends on fluid density)
// for a player-chosen fluid, from archimedesPhysics.ts's own formulas -
// never a faked/visual-only value. The object's own physical parameters
// (mass, objectVolume, and for a choice challenge, objectDensity) are always
// preserved untouched: only what the FLUID contributes changes. Same id and
// conceptId as the input challenge - this is the same experiment with a
// different fluid, never a newly generated one.
// --------------------------------------------------------------------------

export function initialFluidForChallenge(challenge: ArchimedesChallenge): ArchimedesFluid {
  return ARCHIMEDES_FLUIDS.find((f) => f.name === challenge.setup.fluidName) ?? ARCHIMEDES_FLUIDS[0];
}

export function applyFluidToChallenge(challenge: ArchimedesChallenge, fluid: ArchimedesFluid): ArchimedesChallenge {
  const setup: ArchimedesObjectSetup = { ...challenge.setup, fluidDensity: fluid.density, fluidName: fluid.name };

  if (challenge.kind === "choice") {
    return {
      ...challenge,
      setup,
      correctAnswer: floatingOutcome(challenge.objectDensity, fluid.density),
      prompt: floatSinkPrompt(fluid, challenge.objectDensity),
    };
  }

  const derived = deriveState(setup);
  const shared = {
    ...challenge,
    setup,
    actualWeight: derived.actualWeight,
    apparentWeight: derived.apparentWeightValue,
    displacedVolume: derived.displacedVolume,
    buoyantForce: derived.buoyantForceValue,
  };
  switch (challenge.solveFor) {
    case "buoyantForce":
      return { ...shared, targetValue: derived.buoyantForceValue, prompt: buoyantForcePrompt(setup, derived) };
    case "apparentWeight":
      return { ...shared, targetValue: derived.apparentWeightValue, prompt: apparentWeightPrompt(setup, derived) };
    case "displacedVolume":
      return { ...shared, targetValue: derived.displacedVolume, prompt: displacedVolumePrompt(setup, derived) };
    case "fluidDensity":
      return { ...shared, targetValue: setup.fluidDensity, prompt: fluidDensityPrompt(setup, derived) };
  }
}

// --------------------------------------------------------------------------
// Given-field display - what the HUD shows as already-known, mirroring
// wavesChallenge.ts's own givenFieldsForWaveChallenge. Whichever quantity a
// challenge's own solveFor names is never shown here.
// --------------------------------------------------------------------------

export function givenFieldsForArchimedesChallenge(challenge: ArchimedesChallenge): { label: string; value: string }[] {
  if (challenge.kind === "choice") {
    return [
      { label: "Object density", value: `${challenge.objectDensity.toFixed(1)} kg/m³` },
      { label: "Fluid density", value: `${challenge.setup.fluidDensity.toFixed(1)} kg/m³ (${challenge.setup.fluidName})` },
    ];
  }
  switch (challenge.solveFor) {
    case "buoyantForce":
      return [
        { label: "Weight in air", value: `${challenge.actualWeight.toFixed(2)} N` },
        { label: "Apparent weight (submerged)", value: `${challenge.apparentWeight.toFixed(2)} N` },
      ];
    case "apparentWeight":
      return [
        { label: "Mass", value: `${challenge.setup.mass.toFixed(2)} kg` },
        { label: "Fluid density", value: `${challenge.setup.fluidDensity.toFixed(1)} kg/m³ (${challenge.setup.fluidName})` },
        { label: "Displaced volume", value: `${challenge.displacedVolume.toFixed(4)} m³` },
      ];
    case "displacedVolume":
      return [
        { label: "Buoyant force", value: `${challenge.buoyantForce.toFixed(2)} N` },
        { label: "Fluid density", value: `${challenge.setup.fluidDensity.toFixed(1)} kg/m³ (${challenge.setup.fluidName})` },
      ];
    case "fluidDensity":
      return [
        { label: "Buoyant force", value: `${challenge.buoyantForce.toFixed(2)} N` },
        { label: "Displaced volume", value: `${challenge.displacedVolume.toFixed(4)} m³` },
      ];
  }
}

// --------------------------------------------------------------------------
// Answer validation + evaluation - same { value } | { error } shape as
// wavesChallenge.ts's validateWaveAnswer, so a numeric-answer UI can gate its
// submit button identically. Never a string comparison for a numeric
// physics answer - always a tolerance-gated numeric distance.
// --------------------------------------------------------------------------

export type ArchimedesAnswerValidation = { value: number } | { error: string };

export function validateArchimedesAnswer(raw: string): ArchimedesAnswerValidation {
  const trimmed = raw.trim();
  if (trimmed === "") return { error: "Enter a value." };
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { error: "Enter a valid number." };
  if (value < 0) return { error: "Enter a non-negative value." };
  if (value > 1_000_000) return { error: "That value is unrealistically large." };
  return { value };
}

export interface ArchimedesNumericResult {
  readonly correct: boolean;
  readonly submittedValue: number;
  readonly targetValue: number;
}

export function evaluateArchimedesNumericAnswer(challenge: ArchimedesNumericChallenge, submittedValue: number): ArchimedesNumericResult {
  return {
    correct: Math.abs(submittedValue - challenge.targetValue) <= challenge.tolerance,
    submittedValue,
    targetValue: challenge.targetValue,
  };
}

export interface ArchimedesChoiceResult {
  readonly correct: boolean;
  readonly submittedAnswer: FloatingOutcome;
  readonly correctAnswer: FloatingOutcome;
}

export function evaluateArchimedesChoiceAnswer(challenge: ArchimedesChoiceChallenge, submittedAnswer: FloatingOutcome): ArchimedesChoiceResult {
  return { correct: submittedAnswer === challenge.correctAnswer, submittedAnswer, correctAnswer: challenge.correctAnswer };
}

// --------------------------------------------------------------------------
// READY / MEASURING_AIR / MEASURING_WATER / RESULT play state machine - the
// same "small explicit phase state machine" shape as gravitationChallenge.ts's
// GravitationPlayState. An answer can only be submitted once the player has
// actually walked through measuring the object in air and then submerged -
// never skippable straight from READY, so the experiment is a real
// interaction rather than a form.
// --------------------------------------------------------------------------

export type ArchimedesPlayPhase = "READY" | "MEASURING_AIR" | "MEASURING_WATER" | "RESULT";

export interface ArchimedesPlayState {
  readonly phase: ArchimedesPlayPhase;
  // Bumped on every reset/new challenge so a controlled ArchimedesScene can
  // be told to snap back to a genuinely fresh (in-air) visual state, exactly
  // like GravitationPlayState.attemptId does for GravitationScene.
  readonly attemptId: number;
  readonly result: ArchimedesNumericResult | ArchimedesChoiceResult | null;
}

export function createArchimedesPlayState(): ArchimedesPlayState {
  return { phase: "READY", attemptId: 0, result: null };
}

export function measureInAir(state: ArchimedesPlayState): ArchimedesPlayState {
  if (state.phase !== "READY") return state;
  return { ...state, phase: "MEASURING_AIR" };
}

export function submergeObject(state: ArchimedesPlayState): ArchimedesPlayState {
  if (state.phase !== "MEASURING_AIR") return state;
  return { ...state, phase: "MEASURING_WATER" };
}

export function submitArchimedesNumericAnswer(state: ArchimedesPlayState, challenge: ArchimedesNumericChallenge, submittedValue: number): ArchimedesPlayState {
  if (state.phase !== "MEASURING_WATER") return state;
  return { ...state, phase: "RESULT", result: evaluateArchimedesNumericAnswer(challenge, submittedValue) };
}

export function submitArchimedesChoiceAnswer(state: ArchimedesPlayState, challenge: ArchimedesChoiceChallenge, submittedAnswer: FloatingOutcome): ArchimedesPlayState {
  if (state.phase !== "MEASURING_WATER") return state;
  return { ...state, phase: "RESULT", result: evaluateArchimedesChoiceAnswer(challenge, submittedAnswer) };
}

export function resetArchimedesAttempt(state: ArchimedesPlayState): ArchimedesPlayState {
  return { phase: "READY", attemptId: state.attemptId + 1, result: null };
}

// Exposed for tests/consumers that want a fresh id sequence between runs
// (e.g. between test files) - challenge ids are otherwise just a monotonic
// counter, never meaningful physics.
export function resetArchimedesChallengeIdSequenceForTests(): void {
  nextChallengeId = 1;
}
