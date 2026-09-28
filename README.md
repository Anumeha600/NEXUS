# NEXUS

### AI-Powered Adaptive Physics Learning Game

**Team:** Team NEXUS  
**Hackathon:** Bit N Build – Around the World 2026  
**Problem Statement:** PSN018 – AI-Powered Adaptive Learning Game

🌐 **Live Demo:** https://nexus-web-2d.vercel.app/

📦 **GitHub Repository:** https://github.com/Anumeha600/NEXUS

---

# 🚀 Overview

NEXUS is an AI-powered adaptive physics learning game that transforms traditional physics education into an interactive, personalized learning experience.

Instead of presenting every learner with the same fixed sequence of questions, NEXUS continuously adapts the learning experience based on the learner's performance.

The platform combines:

- Interactive 2D physics simulations
- Deterministic adaptive learning
- Concept-level mastery tracking
- Dynamic challenge generation
- Structured learning events
- AI-powered learning insights
- Personalized mistake explanations
- Targeted practice recommendations

The core philosophy is:

> **Don't just give students more questions. Give them the right next learning experience.**

---

# 🎯 Problem Statement

Traditional digital learning platforms often follow a fixed learning path:

```text
Question
   ↓
Answer
   ↓
Score
   ↓
Next Question

This does not necessarily reflect what the learner actually needs.
A student may:
- Understand one concept but struggle with another
- Repeatedly make the same conceptual mistake
- Need additional reinforcement before moving forward
- Already understand a concept and require a more challenging problem
- Know the formula but struggle to apply it to a physical situation
Physics presents an additional challenge because many concepts are mathematical representations of physical behavior.
Simply memorizing a formula does not guarantee conceptual understanding.
NEXUS addresses this by turning physics concepts into interactive experiments and connecting learner performance directly to an adaptive learning engine.
💡 Proposed Solution
NEXUS creates a continuous adaptive learning loop:
                 ┌─────────────────────┐
                 │   PHYSICS EXPERIMENT │
                 └──────────┬──────────┘
                            ↓
                   Student Attempt
                            ↓
                 ┌─────────────────────┐
                 │   ADAPTIVE ENGINE   │
                 └──────────┬──────────┘
                            ↓
                  Structured Learning
                       Event
                       /   \
                      /     \
                     ↓       ↓
          Next Challenge    AI Insight
          Deterministic       Service
                              ↓
                           LLM / Groq
                              ↓
                    Personalized Feedback

The Adaptive Engine is responsible for authoritative learning decisions.
It determines:
- Difficulty
- Challenge parameters
- Concept reinforcement
- Concept progression
- Module progression
- Mastery updates
The AI layer operates downstream of the adaptive engine.
It provides:
- Personalized explanations
- Mistake analysis
- Concept clarification
- Learning-pattern identification
- Practice recommendations
- Session-level insights
The AI does not control:
- Correctness
- Score
- Mastery
- Difficulty
- Concept progression
- Module progression
- Challenge generation
This separation keeps the adaptive learning system deterministic and testable while allowing AI to provide flexible natural-language feedback.
🧠 Core Learning Philosophy
NEXUS is built around one principle:
Learning should respond to the learner.

A conventional learning system may behave like:
Static Content
      ↓
Static Questions
      ↓
Score
      ↓
Next Question

NEXUS instead follows:
Interactive Experiment
        ↓
Student Performance
        ↓
Adaptive Evaluation
        ↓
Learning Event
        ↓
Personalized Challenge
        ↓
AI Learning Insight
        ↓
Targeted Practice
        ↓
Next Attempt

This creates a continuous:
PLAY → PERFORM → UNDERSTAND → ADAPT → PLAY

learning loop.
🎮 The NEXUS Learning Loop
A typical attempt follows this pipeline:
1. Start Experiment
        ↓
2. Receive Adaptive Challenge
        ↓
3. Interact With Physics Simulation
        ↓
4. Submit Answer / Complete Experiment
        ↓
5. Evaluate Performance
        ↓
6. Update Concept Mastery
        ↓
7. Generate Learning Event
        ↓
       ┌───────────────────────┐
       │                       │
       ↓                       ↓
Next Adaptive Challenge    AI Insight Service
                               ↓
                         Personalized Analysis
                               ↓
                         Practice Recommendation
                               │
       └───────────────┬───────┘
                       ↓
                  Next Attempt

Every completed attempt becomes structured learning data.
A Learning Event contains structured information about:
- Session
- Module
- Concept
- Challenge type
- Difficulty
- Target value
- Actual value
- Success
- Performance
- Mastery before the attempt
- Mastery after the attempt
- Attempt number
- Recent attempt context
🔬 Why Physics?
Physics is particularly suited to an interactive adaptive learning environment because equations describe relationships between measurable physical quantities.
NEXUS connects the mathematical representation with an observable simulation.
Instead of:
Formula
   ↓
Numerical Question
   ↓
Answer

the learner experiences:
Formula
   ↓
Interactive Parameters
   ↓
Physics Simulation
   ↓
Observable Behavior
   ↓
Challenge
   ↓
Student Response

This creates a connection between:
Equation ↔ Parameters ↔ Simulation ↔ Result

rather than treating equations as isolated formulas.
🌌 8 Physics Learning Labs
NEXUS provides eight interactive physics learning modules:
1. Projectile Motion
2. Newton's Laws
3. Work & Energy
4. Momentum & Collisions
5. Circular Motion
6. Gravitation & Orbits
7. Wave Motion
8. Archimedes' Principle / Buoyancy
Each module represents physics concepts as an interactive experiment.
The modules are accessible through the unified Physics Labs experience.
Dashboard
   ↓
Physics Labs
   ↓
Play Hub
   ↓
Interactive Physics Lab

The same curriculum is also represented in the Learn section, allowing learners to move between conceptual explanations and experimentation.
🏹 1. Projectile Motion
Projectile Motion introduces the relationship between launch velocity, gravity, trajectory, and range.
Core relationship:
R = v² / g

The simulation allows learners to experiment with launch conditions and observe projectile behavior.
The learning experience includes:
- Launch velocity challenges
- Range calculations
- Gravity variations
- Numerical answer challenges
- Projectile trajectory visualization
- Target landing
- Adaptive difficulty
Gravity is represented through difficulty tiers:
Beginner       → 6.0 – 9.8 m/s²
Intermediate   → 9.8 – 14.0 m/s²
Advanced       → 14.0 – 19.6 m/s²

The learner can connect the selected parameters to the resulting projectile trajectory.
⚙️ 2. Newton's Laws
The Newton's Laws lab focuses on force, acceleration, net force, and friction.
Core relationships include:
F_net = F_applied + F_extra

a = F_net / m

The simulation represents a cart moving along a physical track with force vectors.
Concepts include:
- Force & Acceleration
- Net Force
- Friction
The learner can observe how changes in force and mass affect acceleration.
The simulation uses a physical track representation and ties experiment completion to the motion of the cart.
⚡ 3. Work & Energy
The Work & Energy lab connects applied force, displacement, kinetic energy, and the work-energy theorem.
Core relationships:
W = F · d

KE = ½mv²

W_net = ΔKE

Concepts include:
- Work
- Kinetic Energy
- Work-Energy Theorem
The simulation provides an energy-focused environment where displacement and motion are visually represented while the learner solves concept-specific challenges.
💥 4. Momentum & Collisions
Momentum & Collisions introduces momentum, impulse, and conservation of momentum through interacting carts.
Core relationships:
p = mv

J = m(v_f - v_i)

J = FΔt

The lab supports collision analysis including:
Elastic Collision
Perfectly Inelastic Collision
Conservation of Momentum

The simulation models:
Before Collision
      ↓
Physical Impact
      ↓
After Collision
      ↓
Observation

Elastic collisions cause the carts to separate after impact.
Perfectly inelastic collisions cause the carts to stick together.
The experiment is considered complete only after the physical collision and observation period have occurred.
🔄 5. Circular Motion
The Circular Motion lab explores the relationship between angular velocity, tangential velocity, centripetal acceleration, and centripetal force.
Core relationships include:
v = ωr

a_c = v² / r

a_c = ω²r

F_c = ma_c

F_c = mv² / r

T = 2πr / v

f = 1 / T

The simulation represents an object moving around a circular path.
The learner can observe:
- Circular position
- Tangential velocity
- Inward centripetal force
- Rotating vectors
- Angular motion
- Required revolutions
Challenges include:
- Centripetal Force
- Centripetal Acceleration
- Circular Speed
🌍 6. Gravitation & Orbits
The Gravitation lab introduces gravitational force, gravitational acceleration, orbital velocity, and escape velocity.
The simulation supports different orbital outcomes including:
- Falling trajectories
- Circular orbits
- Elliptical orbits
- Sub-escape trajectories
- Escape trajectories
- Collision outcomes
The learner can control the initial velocity and observe the resulting motion around a planet.
The simulation includes:
- Planet
- Trajectory
- Velocity vector
- Gravity vector
- Distance indicator
- Orbit / escape / collision outcomes
Adaptive challenges include:
- Orbital Velocity
- Escape Velocity
- Gravitational Force exploration
The adaptive engine only scores concepts that are supported by the adaptive challenge flow.
🌊 7. Wave Motion
The Wave Motion lab introduces amplitude, frequency, wavelength, period, wave speed, and superposition.
Core relationships include:
k = 2π / λ

ω = 2πf

T = 1 / f

v = fλ

The wave equation used by the simulation is:
y(x,t) = A sin(kx − ωt + φ)

The lab also supports wave superposition.
Resultant amplitude can be represented as:
A_resultant =
√(A₁² + A₂² + 2A₁A₂ cos(Δφ))

Concepts include:
- Amplitude
- Frequency & Wavelength
- Wave Speed
- Superposition
Challenge types include:
- Reading a wave
- Matching a target amplitude
- Determining frequency
- Determining wavelength
- Calculating wave speed
- Identifying constructive/destructive interference
- Predicting resultant amplitude
A dedicated Reset control allows the learner to restart the current challenge without changing the adaptive state.
💧 8. Archimedes' Principle / Buoyancy
The Archimedes lab turns buoyancy into a physical measurement experiment.
Core relationship:
F_B = ρ_f g V_displaced

Apparent weight:
W_apparent = W_actual - F_B

Density:
ρ = m / V

The lab includes:
- Buoyant Force
- Apparent Weight
- Displaced Volume
- Fluid Density
- Float / Sink behavior
Supported fluids include:
Water        → 1000 kg/m³
Salt Water   → 1025 kg/m³
Olive Oil    → 920 kg/m³
Glycerin     → 1260 kg/m³

The experiment follows a measurement sequence:
READY
  ↓
MEASURING AIR
  ↓
MEASURING FLUID
  ↓
RESULT

The learner interacts with a spring balance, object, and fluid container while the simulation provides live weight and buoyancy information.
🎯 From Formula to Experiment
Across all eight labs, NEXUS follows the same educational philosophy:
CONCEPT
   ↓
FORMULA
   ↓
INTERACTIVE PARAMETERS
   ↓
PHYSICS SIMULATION
   ↓
CHALLENGE
   ↓
STUDENT RESPONSE
   ↓
ADAPTIVE EVALUATION
   ↓
PERSONALIZED LEARNING

The result is a physics learning environment where every experiment can become a signal for what the learner should experience next.
🧠 Adaptive Learning Engine
The core intelligence of NEXUS is the Adaptive Learning Engine.
Instead of using a fixed difficulty progression, the engine evaluates learner performance and uses that information to determine what should happen next.
The adaptive system is deterministic.
Given the same learner state and the same learning event, the engine produces the same adaptive decision.
Adaptive Decision Pipeline
Student Attempt
      ↓
Challenge Evaluation
      ↓
Performance Calculation
      ↓
Mastery Update
      ↓
Concept State
      ↓
Adaptive Decision
      ↓
Next Challenge

The engine continuously maintains concept-level learning state rather than treating the entire subject as one score.
📊 Performance Evaluation
NEXUS combines multiple signals when evaluating an attempt.
The performance model uses:
Performance =
    0.6 × Accuracy
  + 0.3 × Success
  + 0.1 × Speed

This allows the adaptive system to consider more than whether an answer was simply correct.
The resulting performance signal contributes to the learner's concept mastery.
📈 Mastery Tracking
Concept mastery is updated incrementally rather than being completely replaced after every attempt.
The engine uses an exponential moving update combined with a performance trend:
mastery =
    mastery
    + 0.25 × (performance - mastery)
    + 0.05 × trend

This allows the system to react to recent performance while retaining information from previous attempts.
The result is a continuously evolving concept state.
🔁 Concept Progression
NEXUS uses mastery thresholds to determine whether a learner should remain on the current concept or progress.
The conceptual behavior is:
Low Mastery
    ↓
Reinforce Current Concept
    ↓
More Practice

Intermediate Mastery
    ↓
Continue Current Concept
    ↓
Additional Practice

High Mastery
    ↓
Progress
    ↓
Next Concept

The adaptive engine therefore avoids treating a single correct or incorrect answer as sufficient evidence of mastery.
🎯 Weak Concept Reinforcement
When a learner repeatedly struggles with a concept, the adaptive engine can reinforce that concept rather than immediately moving forward.
Weak Concept
     ↓
Additional Challenge
     ↓
New Attempt
     ↓
Mastery Update
     ↓
Evaluate Again

The goal is to provide more practice where the learner needs it.
⚙️ Adaptive Difficulty
Difficulty is generated by the adaptive system rather than exposed as a manual difficulty selector.
The learner does not choose:
Easy
Medium
Hard

Instead:
Performance
    ↓
Mastery
    ↓
Adaptive Difficulty
    ↓
Next Challenge

This allows the game to respond to learner performance during the experience.
🧩 Concept-Level Adaptation
Each physics lab is divided into specific concepts.
For example, Circular Motion contains concepts related to:
- Centripetal Force
- Centripetal Acceleration
- Circular Speed
Other modules similarly contain their own concept sequences.
This allows the engine to distinguish between:
Strong Concept
      ≠
Weak Concept

instead of assigning one global score to the entire physics subject.
🧪 Challenge Generation
The Adaptive Engine generates the next challenge using the learner's current adaptive state.
The challenge can vary through parameters such as:
- Numerical values
- Difficulty
- Challenge type
- Physical conditions
- Target values
- Required quantity
- Scenario parameters
This allows the same underlying concept to produce different learning experiences.
Same Concept
     ↓
Different Parameters
     ↓
Different Challenge
     ↓
Same Learning Objective

🧠 Deterministic Adaptation
A key architectural decision in NEXUS is that the AI model does not decide the adaptive state.
The system is intentionally separated:
                 ┌────────────────────┐
                 │  Adaptive Engine   │
                 │                    │
                 │ • Mastery          │
                 │ • Difficulty       │
                 │ • Progression      │
                 │ • Challenge        │
                 └─────────┬──────────┘
                           │
                           ↓
                    Learning Event
                           │
                           ↓
                 ┌────────────────────┐
                 │    AI Service      │
                 │                    │
                 │ • Explanation      │
                 │ • Analysis         │
                 │ • Insights         │
                 │ • Recommendations  │
                 └────────────────────┘

This means an LLM response cannot silently change the authoritative learning state.
🤖 AI Learning Insight Service
NEXUS adds a generative AI layer after the adaptive learning decision.
The AI receives a structured learning event rather than directly controlling the game.
The architecture is:
GAME
  ↓
ADAPTIVE ENGINE
  ↓
STRUCTURED LEARNING EVENT
  ├──────────────→ NEXT CHALLENGE
  │
  └──────────────→ AI LEARNING INSIGHT SERVICE
                          ↓
                     LLM PROVIDER
                          ↓
                PERSONALIZED INSIGHT

The AI therefore acts as a learning assistant rather than the authority over the game.
💬 AI-Powered Learning Insights
After an attempt, the structured learning event can be sent to the AI insight service.
The service can generate feedback such as:
- What went wrong
- Which concept was involved
- Why the mistake may have occurred
- What relationship or formula should be reviewed
- What pattern is visible across recent attempts
- What the learner should practice next
The purpose is not simply to say:
Wrong Answer

but to turn the attempt into an explanation.
🔍 Personalized Mistake Analysis
NEXUS stores structured learning events so that AI insights can be based on actual learner attempts.
The AI can receive context such as:
Module
Concept
Challenge Type
Difficulty
Target Value
Actual Value
Success
Performance
Mastery Before
Mastery After
Attempt Number
Recent Attempts

This gives the AI more useful context than sending an isolated question and answer.
Instead of:
Question → Answer → Explanation

NEXUS can provide:
Question
   +
Current Attempt
   +
Previous Attempt Context
   +
Concept Mastery
   ↓
Personalized Insight

🧾 Learning Events
A Learning Event acts as the common language between the game, adaptive engine, session history, and AI insight service.
A typical event contains:
{
  "id": "...",
  "session_id": "...",
  "module": "...",
  "concept": "...",
  "challenge_type": "...",
  "difficulty": "...",
  "target_value": 0,
  "actual_value": 0,
  "success": true,
  "performance": 0,
  "mastery_before": 0,
  "mastery_after": 0,
  "attempt_number": 1,
  "recent_attempts": [],
  "context": {}
}

The event captures the learning state at the time of the attempt.
This allows different parts of the system to work from the same structured representation.
🔗 Session History
NEXUS maintains session-level learning history for attempts made during the current learning session.
The flow is:
Attempt
   ↓
Learning Event
   ↓
Session History
   ↓
AI Insight
   ↓
Insight Attached to Attempt

Each attempt receives an identifier so that an asynchronously generated AI insight can be associated with the exact attempt that produced it.
This prevents the AI response from becoming detached from the original learning event.
💾 Insight Persistence
The AI response is associated with the corresponding session attempt.
Attempt ID
    ↓
Session Attempt
    ↓
AI Request
    ↓
AI Response
    ↓
Validate Response
    ↓
Update Matching Attempt

This allows the AI Insights page to display insights generated from actual attempts.
🛡️ AI Responsibility Boundary
NEXUS deliberately separates deterministic learning decisions from generative AI.
Responsibility	Adaptive Engine	AI
Correctness	✅	❌
Score	✅	❌
Mastery	✅	❌
Difficulty	✅	❌
Challenge Generation	✅	❌
Concept Progression	✅	❌
Module Progression	✅	❌
Explanations	❌	✅
Mistake Analysis	❌	✅
Learning Insights	❌	✅
Practice Recommendations	❌	✅


This architecture ensures that an LLM response cannot directly determine the authoritative state of the learner.
🔐 AI Failure Handling
AI is an enhancement to the learning experience, not a dependency for the physics engine.
If the AI service is unavailable:
Physics Game
     ↓
Attempt
     ↓
Adaptive Engine
     ↓
Mastery Update
     ↓
Next Challenge

The learning experience can continue.
Failures in the AI or network layer are handled without blocking gameplay.
🌐 AI Provider Architecture
The NEXUS AI layer uses an OpenAI-compatible API interface.
The server-side configuration uses:
LLM_API_KEY=your_api_key_here
LLM_BASE_URL=https://api.groq.com/openai/v1/chat/completions
LLM_MODEL=openai/gpt-oss-20b

The credentials remain server-side and are not embedded into the client application.
The architecture is:
Browser
   ↓
NEXUS Application
   ↓
/api/insight
   ↓
LLM Provider
   ↓
Generated Learning Insight
   ↓
NEXUS Session History
   ↓
AI Insights UI

🖥️ Product Experience
NEXUS is organized around five primary product surfaces:
             NEXUS
                │
      ┌─────────┼─────────┐
      ↓         ↓         ↓
  Dashboard    Play      Learn
      │         │         │
      └────┬────┴────┬────┘
           ↓         ↓
       Progress   AI Insights

Each surface serves a different part of the learning experience.
🏠 Dashboard
The Dashboard provides the learner with a high-level view of NEXUS.
It connects the learner to:
- Physics Labs
- Learning Journey
- Progress
- AI-generated learning insights
The dashboard presents the eight physics labs as part of the overall NEXUS learning experience.
🎮 Play Hub
The Play section acts as the central entry point for the interactive physics labs.
The learner can choose among:
Projectile Motion
Newton's Laws
Work & Energy
Momentum & Collisions
Circular Motion
Gravitation & Orbits
Wave Motion
Archimedes' Principle

Each lab launches its corresponding interactive experience.
The Play Hub acts as the bridge between the curriculum and the simulation layer.
📚 Learn
The Learn section provides the conceptual side of NEXUS.
Each module exposes its concepts so that learners can review the underlying physics before or after experimenting.
The learning relationship becomes:
LEARN
  ↓
Understand Concept
  ↓
PLAY
  ↓
Apply Concept
  ↓
PERFORM
  ↓
ADAPT
  ↓
LEARN AGAIN

📈 Progress
The Progress experience focuses on the learner's current learning state and recorded activity.
NEXUS intentionally avoids fabricating long-term progress that has not actually been recorded.
Displayed progress is based on the available learning data and adaptive state.
🤖 AI Insights
The AI Insights page turns recorded learning attempts into understandable feedback.
It can surface:
- Recent AI explanations
- Mistake patterns
- Weak concepts
- Practice recommendations
- Session-level learning observations
The experience connects:
Real Attempt
    ↓
Structured Learning Event
    ↓
AI Analysis
    ↓
Personalized Insight
    ↓
Recommended Practice

The learner therefore gets more than a numerical result.
They receive an explanation of what their recent performance means.
🏗️ System Architecture
At a high level, NEXUS can be viewed as five connected layers:
┌──────────────────────────────────────┐
│          PRODUCT EXPERIENCE          │
│ Dashboard / Play / Learn / Progress  │
│              / Insights              │
└──────────────────┬───────────────────┘
                   ↓
┌──────────────────────────────────────┐
│          GAME EXPERIENCE             │
│ Interactive Physics Experiments      │
│ Challenges / Controls / Simulation    │
└──────────────────┬───────────────────┘
                   ↓
┌──────────────────────────────────────┐
│         ADAPTIVE ENGINE              │
│ Mastery / Difficulty / Progression   │
│ Challenge Generation / Reinforcement │
└──────────────────┬───────────────────┘
                   ↓
┌──────────────────────────────────────┐
│         LEARNING EVENT               │
│ Structured representation of attempt │
└──────────────────┬───────────────────┘
                   ↓
┌──────────────────────────────────────┐
│           AI INSIGHT                 │
│ Explanation / Analysis / Guidance    │
└──────────────────────────────────────┘

🔄 Runtime Workflow
A complete learner interaction follows:
Open NEXUS
     ↓
Choose Physics Lab
     ↓
Start Challenge
     ↓
Interact With Simulation
     ↓
Submit / Complete Experiment
     ↓
Physics Evaluation
     ↓
Adaptive Engine
     ↓
Mastery Update
     ↓
Learning Event
     ├──────────────→ Next Challenge
     │
     └──────────────→ AI Insight
                           ↓
                    Personalized Feedback
                           ↓
                    Session History
                           ↓
                      AI Insights Page

The learner can then continue with the next adaptive challenge.
🧩 Architecture Principles
NEXUS is built around several architectural principles.
1. Deterministic Adaptation
The adaptive engine owns authoritative learning decisions.
2. AI as a Downstream Service
The AI interprets learning events but does not control the game state.
3. Physics First
Correctness and simulation behavior originate from the physics implementation rather than the language model.
4. Concept-Level Learning
Mastery is tracked around concepts instead of treating the entire subject as one score.
5. Graceful AI Failure
The core learning loop does not depend on successful AI generation.
6. Structured Learning Data
Learning Events provide a common representation shared by the game, adaptive engine, session history, and AI service.
🛠️ Technology Stack
The NEXUS implementation uses a modern web and game-oriented stack.
Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS
Physics & Game Layer
- TypeScript-based physics engines
- Interactive 2D simulations
- Deterministic challenge generation
- Canvas-based visual experiences
Adaptive Learning
- Custom Adaptive Engine
- Concept mastery tracking
- Difficulty adaptation
- Challenge generation
- Learning event pipeline
AI
- Server-side AI insight API
- OpenAI-compatible API interface
- Groq
- openai/gpt-oss-20b
Deployment
- Vercel
- GitHub
📁 Project Structure
The project is organized into separate layers for the web application, game logic, shared curriculum/data, and adaptive learning functionality.
NEXUS/
├── game-2d/
│   └── src/
│       ├── adaptiveEngine.ts
│       ├── learningEventPipeline.ts
│       ├── GameCanvas.tsx
│       ├── HowToPlay.tsx
│       ├── gravitation/
│       ├── waves/
│       ├── archimedes/
│       └── ...
│
├── shared/
│   └── src/
│       ├── curriculum.ts
│       ├── insight.ts
│       └── sessionHistory.ts
│
├── web-2d/
│   └── src/
│       ├── app/
│       ├── components/
│       └── ...
│
└── README.md

The exact implementation should be treated as the source of truth for the current repository structure.
🔐 Environment Variables
NEXUS uses server-side environment variables for the AI provider.
Create a local environment file in the web application:
LLM_API_KEY=your_api_key_here
LLM_BASE_URL=https://api.groq.com/openai/v1/chat/completions
LLM_MODEL=openai/gpt-oss-20b

Security Notes
- Never commit the API key.
- Keep .env.local ignored by Git.
- Never expose the API key to the browser.
- AI credentials should only be accessed by server-side code.
- Use a fresh key for deployment if an existing key has been exposed.
💻 Local Development
Clone the repository:
git clone https://github.com/Anumeha600/NEXUS.git
cd NEXUS

Install dependencies according to the repository's package configuration.
Run the web application:
cd web-2d
npm install
npm run dev

Open:
http://localhost:3000

Main product routes include:
/
 /play
 /learn
 /progress
 /insights

Physics labs are accessed through the Play Hub and their module routes/query parameters.
🧪 Testing
NEXUS includes automated tests for the physics engines, adaptive behavior, learning-event pipeline, challenge generation, and related functionality.
The latest verified project state contains:
603 / 603 tests passing

The test suite covers multiple layers including:
- Physics calculations
- Challenge generation
- Adaptive learning
- Mastery behavior
- Learning events
- Learning-event pipeline
- Module-specific behavior
Additional validation includes:
Typecheck  → PASS
Lint       → PASS
Build      → PASS

🚀 Deployment
NEXUS is deployed using Vercel.
Production URL
https://nexus-web-2d.vercel.app/

Repository
https://github.com/Anumeha600/NEXUS

The web application is deployed from the web-2d application.
The production environment requires the AI environment variables:
LLM_API_KEY
LLM_BASE_URL
LLM_MODEL

The API key must be configured through the deployment platform's environment-variable system and must not be committed to Git.
🔒 Security & Reliability
NEXUS follows a server-side AI architecture.
The browser does not directly receive the LLM API credential.
Client
  ↓
NEXUS Server
  ↓
AI Insight API
  ↓
LLM Provider

The system also separates AI failure from learning failure.
If the AI service cannot respond:
AI Failure
   ↓
Gameplay Continues
   ↓
Adaptive Engine Continues

This prevents an external AI dependency from becoming a single point of failure for the core learning experience.
🎬 Recommended Hackathon Demo Flow
A concise NEXUS demonstration can follow this sequence:
1. Start on the Dashboard
Show the NEXUS interface and the eight Physics Labs.
2. Open the Play Hub
Demonstrate that the platform contains multiple playable physics domains.
3. Select a Physics Lab
Choose a visually engaging module such as Projectile Motion, Momentum & Collisions, Circular Motion, Gravitation, Wave Motion, or Archimedes.
4. Demonstrate the Simulation
Show that the learner interacts with an actual physics experiment rather than a static question.
5. Complete a Challenge
Submit a numerical, conceptual, or simulation-based challenge.
6. Explain Adaptation
Show how the Adaptive Engine records the attempt and determines the next learning experience.
7. Demonstrate AI Feedback
Use the AI Insights experience to show the generated explanation or learning recommendation.
8. Explain the Architecture
Highlight:
Physics Engine
      ↓
Adaptive Engine
      ↓
Learning Event
      ↓
AI Insight

9. Show the Eight-Lab Breadth
Return to the Play Hub and show the complete physics curriculum.
10. End With the Core Idea
Every attempt is not just an answer.

It is a learning signal.

🏆 Why NEXUS?
NEXUS combines several components into one learning loop:
Interactive Physics
Learners observe physical behavior instead of only reading formulas.
Adaptive Learning
Difficulty and challenge generation respond to learner performance.
Concept-Level Mastery
The system can distinguish between different concepts instead of treating physics as one score.
Deterministic Intelligence
The authoritative adaptive state is controlled by a deterministic engine.
Generative AI
AI provides natural-language explanations and personalized learning insights.
Eight Playable Labs
The platform covers eight different physics domains.
Learning Event Architecture
Every attempt can become structured data for both adaptation and explanation.
🌱 Potential Impact
The architecture demonstrated by NEXUS can be extended beyond physics.
The same pattern can be applied to other educational domains:
Subject
   ↓
Interactive Activity
   ↓
Performance
   ↓
Adaptive Engine
   ↓
Learning Event
   ↓
AI Explanation
   ↓
Personalized Practice

Potential applications include:
- Mathematics
- Programming
- Chemistry
- Electronics
- Engineering fundamentals
- STEM laboratory simulations
The physics implementation serves as the foundation for demonstrating this broader adaptive-learning architecture.
🔮 Future Scope
Potential future extensions include:
Persistent Learner Profiles
Move beyond session-level learning and maintain longer-term learner progress.
Expanded Mastery Analytics
Track concept mastery across multiple sessions and learning periods.
Teacher / Instructor Dashboard
Allow educators to view learner progress and identify concepts requiring additional attention.
More Subjects
Extend the same adaptive architecture to:
- Mathematics
- Coding
- Chemistry
- Electronics
- Other STEM subjects
Richer Physics Simulations
Introduce more complex physical environments and experimental scenarios.
Advanced AI Tutoring
Provide deeper conversational explanations while keeping authoritative correctness and progression outside the LLM.
Classroom Deployment
Support larger groups of learners with instructor-facing analytics and structured learning data.
⚠️ Prototype Disclaimer
NEXUS is a hackathon prototype designed to demonstrate an adaptive-learning architecture through interactive physics simulations.
The current implementation focuses on demonstrating:
- Interactive physics learning
- Deterministic adaptation
- Concept-level mastery
- Structured learning events
- AI-generated learning insights
- Personalized practice feedback
The system should therefore be treated as a prototype rather than a replacement for formal classroom instruction, assessment systems, or professional educational evaluation.
🏁 Hackathon
Bit N Build – Around the World 2026
Problem Statement: PSN018 – AI-Powered Adaptive Learning Game
The problem statement asks teams to:
Design a game that adjusts its difficulty and content in real time based on a player's performance, turning a school subject into a personalized, engaging learning loop.

NEXUS addresses this through an interactive physics environment where learner performance becomes the signal that drives the next learning experience.
👥 Team
Team NEXUS
NEXUS was developed as a hackathon project for Bit N Build – Around the World 2026.
🔗 Links
Live Demo
https://nexus-web-2d.vercel.app/
GitHub
https://github.com/Anumeha600/NEXUS
💭 Core Idea
Traditional learning asks:
"What question should the student answer next?"

NEXUS asks:
"What does this student's performance tell us
about what they should experience next?"

The system therefore transforms:
Question
   ↓
Answer

into:
Experiment
   ↓
Performance
   ↓
Learning Event
   ↓
Adaptive Decision
   ↓
Personalized Challenge
   ↓
AI Insight
   ↓
Better Next Attempt

NEXUS turns physics from a sequence of questions into an adaptive learning experience where every attempt becomes a signal for what the learner should experience next.
