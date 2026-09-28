<img width="1600" height="1187" alt="image (1)" src="https://github.com/user-attachments/assets/917c854a-73b5-4428-8873-1c00239605b1" />


# NEXUS

### AI-Powered Adaptive Physics Learning Game

**Team:** Team NEXUS  
**Hackathon:** Bit N Build – Around the World 2026  
**Problem Statement:** PSN018 – AI-Powered Adaptive Learning Game

🌐 **Live Demo:** https://nexus-web-2d.vercel.app/

📦 **GitHub:** https://github.com/Anumeha600/NEXUS

---

## 🚀 Overview

**NEXUS** is an AI-powered adaptive physics learning game designed to turn traditional physics education into an interactive, personalized learning experience.

Traditional learning platforms often present students with fixed sequences of questions and predefined difficulty levels.

NEXUS introduces an adaptive learning loop where student performance becomes a signal for what the learner should experience next.

Instead of simply asking:

> "Did the student answer correctly?"

NEXUS focuses on:

> **What does the student's performance tell us about what they should learn or practice next?**

The system combines:

- Interactive Physics Simulations
- Adaptive Difficulty
- Concept-Level Mastery
- Dynamic Challenge Generation
- Structured Learning Events
- AI Learning Insights
- Personalized Mistake Analysis
- Targeted Practice Recommendations

### Core Concept

```text
Student
   ↓
Interactive Physics Experiment
   ↓
Student Performance
   ↓
Adaptive Engine
   ↓
Learning Event
   ├──────────────→ Next Challenge
   │
   └──────────────→ AI Learning Insight
                           ↓
                      Personalized Feedback
                           ↓
                     Targeted Practice
```

The goal is to create a continuous:

```text
PLAY → PERFORM → UNDERSTAND → ADAPT → PLAY
```

learning loop.

---

# 🎯 Problem Statement

Traditional digital learning platforms often follow a fixed learning model:

```text
Question
   ↓
Answer
   ↓
Score
   ↓
Next Question
```

This does not always account for the learner's actual understanding.

Common challenges include:

- Fixed question sequences
- Static difficulty
- Limited concept-level adaptation
- Repeated mistakes without targeted reinforcement
- Difficulty identifying weak concepts
- Limited personalized explanations
- Physics being taught primarily through formulas
- Lack of connection between mathematical formulas and physical behavior

A student may understand one concept while struggling with another.

Another student may already understand a concept but continue receiving questions at the same level.

NEXUS addresses this gap by turning physics concepts into interactive experiments and connecting learner performance directly to an adaptive learning engine.

---

# 💡 Proposed Solution

NEXUS introduces an intelligent runtime learning layer that connects physics simulation, adaptive learning, structured learning events, and generative AI.

### 1. Interactive Physics

Physics concepts are represented as interactive experiments rather than static questions.

### 2. Performance Evaluation

Each completed challenge produces structured information about the learner's performance.

### 3. Adaptive Learning

The Adaptive Engine updates concept mastery and determines the next challenge.

### 4. Learning Events

The completed attempt is converted into a structured Learning Event.

### 5. AI Learning Insights

The Learning Event can be sent to the AI insight service for personalized explanations and recommendations.

### 6. Personalized Practice

The learner receives feedback that helps explain mistakes and identify what to practice next.

### Architecture

```text
                 PHYSICS GAME
                      ↓
                Student Attempt
                      ↓
              ┌───────────────┐
              │ Adaptive      │
              │ Engine        │
              └───────┬───────┘
                      ↓
               Learning Event
                  /         \
                 /           \
                ↓             ↓
       Next Challenge      AI Insight
       Deterministic         Service
                              ↓
                         LLM Provider
                              ↓
                    Personalized Feedback
```

The Adaptive Engine remains authoritative.

AI is downstream from the adaptive system and does not control the authoritative learning state.

---

# 🧠 Adaptive Learning Philosophy

NEXUS is built around a simple principle:

> **Learning should respond to the learner.**

A conventional learning system may behave like:

```text
Static Content
      ↓
Static Questions
      ↓
Score
      ↓
Next Question
```

NEXUS instead follows:

```text
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
```

This means every attempt can become a learning signal.

---

# 🎮 The NEXUS Learning Loop

A typical attempt follows:

```text
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
       ┌──────────────────────┐
       │                      │
       ↓                      ↓
Next Adaptive Challenge   AI Insight Service
                              ↓
                       Personalized Analysis
                              ↓
                       Practice Recommendation
                              │
       └──────────────┬───────┘
                      ↓
                 Next Attempt
```

---

# 🌌 Physics Learning Labs

NEXUS currently provides **8 interactive Physics Labs**.

| # | Physics Lab | Core Concepts |
|---|---|---|
| 1 | Projectile Motion | Range, launch velocity, gravity |
| 2 | Newton's Laws | Force, acceleration, net force, friction |
| 3 | Work & Energy | Work, kinetic energy, work-energy theorem |
| 4 | Momentum & Collisions | Momentum, impulse, conservation |
| 5 | Circular Motion | Centripetal force, acceleration, angular motion |
| 6 | Gravitation & Orbits | Gravity, orbital velocity, escape velocity |
| 7 | Wave Motion | Amplitude, frequency, wavelength, superposition |
| 8 | Archimedes' Principle | Buoyancy, apparent weight, density |

All eight labs are integrated into the unified Physics Labs experience.

```text
Dashboard
   ↓
Physics Labs
   ↓
Play Hub
   ↓
Interactive Lab
   ↓
Adaptive Challenge
```

---

# 🏹 Projectile Motion

Projectile Motion introduces the relationship between launch velocity, gravity, trajectory, and range.

### Core Formula

```text
R = v² / g
```

The learner interacts with a projectile simulation and observes how the selected parameters affect the resulting trajectory.

### Concepts

- Projectile range
- Launch velocity
- Gravity
- Trajectory

### Features

- Numerical challenges
- Variable gravity
- Projectile animation
- Target landing
- Trajectory visualization
- Adaptive challenge difficulty

Gravity is represented through challenge tiers:

```text
Beginner       → 6.0 – 9.8 m/s²
Intermediate   → 9.8 – 14.0 m/s²
Advanced       → 14.0 – 19.6 m/s²
```

---

# ⚙️ Newton's Laws

The Newton's Laws lab focuses on force, acceleration, net force, and friction.

### Core Relationships

```text
F_net = F_applied + F_extra

a = F_net / m
```

The simulation represents a cart moving along a physical track with force vectors.

### Concepts

- Force & Acceleration
- Net Force
- Friction

### Runtime Flow

```text
Applied Force
      ↓
Net Force
      ↓
Acceleration
      ↓
Cart Motion
```

The simulation uses a physical 5 m track representation and ties completion to the actual simulated motion.

---

# ⚡ Work & Energy

The Work & Energy lab connects applied force, displacement, kinetic energy, and the work-energy theorem.

### Core Relationships

```text
W = F · d

KE = ½mv²

W_net = ΔKE
```

### Concepts

- Work
- Kinetic Energy
- Work-Energy Theorem

The simulation connects:

```text
Force + Displacement
        ↓
      Work
        ↓
Kinetic Energy
        ↓
Work-Energy Relationship
```

---

# 💥 Momentum & Collisions

Momentum & Collisions introduces momentum, impulse, and conservation of momentum through interacting carts.

### Core Relationships

```text
p = mv

J = m(v_f - v_i)

J = FΔt
```

### Collision Types

- Elastic Collision
- Perfectly Inelastic Collision
- Conservation of Momentum

The physical simulation follows:

```text
Before Collision
      ↓
Cart Motion
      ↓
Physical Impact
      ↓
After Collision
      ↓
Observation
```

Elastic collisions cause the carts to separate after impact.

Perfectly inelastic collisions cause the carts to stick together.

The experiment is completed only after the physical collision and observation period have occurred.

---

# 🔄 Circular Motion

The Circular Motion lab explores angular velocity, tangential velocity, centripetal acceleration, centripetal force, period, and frequency.

### Core Relationships

```text
v = ωr

a_c = v² / r

a_c = ω²r

F_c = ma_c

F_c = mv² / r

T = 2πr / v

f = 1 / T
```

### Challenges

- Centripetal Force
- Centripetal Acceleration
- Circular Speed

The simulation represents:

- Circular position
- Tangential velocity
- Inward centripetal force
- Rotating vectors
- Angular motion
- Required revolutions

---

# 🌍 Gravitation & Orbits

The Gravitation lab introduces gravitational force, gravitational acceleration, orbital velocity, escape velocity, and orbital behavior.

### Simulation Outcomes

- Falling trajectories
- Circular orbits
- Elliptical orbits
- Sub-escape trajectories
- Escape trajectories
- Collision outcomes

The learner controls the initial velocity and observes the resulting trajectory around a planet.

### Simulation Components

- Planet
- Trajectory
- Velocity vector
- Gravity vector
- Distance indicator
- Orbit outcomes
- Escape outcomes
- Collision outcomes

### Adaptive Challenges

- Orbital Velocity
- Escape Velocity
- Gravitational Force exploration

The adaptive system only scores concepts supported by the scored adaptive challenge flow.

---

# 🌊 Wave Motion

The Wave Motion lab introduces amplitude, frequency, wavelength, period, wave speed, and superposition.

### Core Relationships

```text
k = 2π / λ

ω = 2πf

T = 1 / f

v = fλ
```

### Wave Equation

```text
y(x,t) = A sin(kx − ωt + φ)
```

### Superposition

```text
A_resultant =
√(A₁² + A₂² + 2A₁A₂ cos(Δφ))
```

### Concepts

- Amplitude
- Frequency & Wavelength
- Wave Speed
- Superposition

### Challenge Types

- Reading a wave
- Matching a target amplitude
- Determining frequency
- Determining wavelength
- Calculating wave speed
- Identifying constructive/destructive interference
- Predicting resultant amplitude

The Wave lab also provides a dedicated Reset control that restarts the current challenge without changing the adaptive state.

---

# 💧 Archimedes' Principle / Buoyancy

The Archimedes lab turns buoyancy into a physical measurement experiment.

### Core Formula

```text
F_B = ρ_f g V_displaced
```

### Apparent Weight

```text
W_apparent = W_actual - F_B
```

### Density

```text
ρ = m / V
```

### Concepts

- Buoyant Force
- Apparent Weight
- Displaced Volume
- Fluid Density
- Float / Sink behavior

### Supported Fluids

| Fluid | Density |
|---|---:|
| Water | 1000 kg/m³ |
| Salt Water | 1025 kg/m³ |
| Olive Oil | 920 kg/m³ |
| Glycerin | 1260 kg/m³ |

### Experiment Flow

```text
READY
  ↓
MEASURING AIR
  ↓
MEASURING FLUID
  ↓
RESULT
```

The learner interacts with a spring balance, object, and fluid container while the simulation provides live weight and buoyancy information.

---

# 🧠 Adaptive Learning Engine

The core intelligence of NEXUS is the **Adaptive Learning Engine**.

Instead of using a fixed difficulty progression, the engine evaluates learner performance and uses that information to determine what should happen next.

```text
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
```

The adaptive engine maintains concept-level learning state instead of treating the entire subject as one score.

---

# 📊 Performance Evaluation

NEXUS combines multiple signals when evaluating an attempt.

The performance model uses:

```text
Performance =
    0.6 × Accuracy
  + 0.3 × Success
  + 0.1 × Speed
```

The resulting performance signal contributes to concept mastery.

---

# 📈 Mastery Tracking

Concept mastery is updated incrementally.

The engine uses an exponential moving update combined with a performance trend:

```text
mastery =
    mastery
    + 0.25 × (performance - mastery)
    + 0.05 × trend
```

This allows the system to respond to recent performance while retaining information from previous attempts.

---

# 🔁 Concept Progression

NEXUS uses mastery thresholds to determine whether a learner should remain on a concept or progress.

```text
Low Mastery
    ↓
Reinforce Current Concept
    ↓
More Practice
```

```text
Intermediate Mastery
    ↓
Continue Current Concept
    ↓
Additional Practice
```

```text
High Mastery
    ↓
Progress
    ↓
Next Concept
```

---

# 🎯 Weak Concept Reinforcement

When a learner struggles with a concept, the adaptive engine can reinforce that concept.

```text
Weak Concept
     ↓
Additional Challenge
     ↓
New Attempt
     ↓
Mastery Update
     ↓
Evaluate Again
```

This creates targeted practice instead of blindly progressing through a fixed question sequence.

---

# ⚙️ Adaptive Difficulty

NEXUS does not expose a manual:

```text
Easy / Medium / Hard
```

selector.

Instead:

```text
Performance
    ↓
Mastery
    ↓
Adaptive Difficulty
    ↓
Next Challenge
```

Challenge parameters are generated according to the learner's current adaptive state.

---

# 🧩 Concept-Level Adaptation

Each Physics Lab contains specific concepts.

For example, Circular Motion contains:

- Centripetal Force
- Centripetal Acceleration
- Circular Speed

This allows the engine to distinguish between:

```text
Strong Concept
      ≠
Weak Concept
```

rather than representing the learner using only one global physics score.

---

# 🧪 Challenge Generation

The Adaptive Engine generates the next challenge using the learner's current adaptive state.

Challenge parameters can vary according to the individual module, including:

- Numerical values
- Difficulty
- Challenge type
- Physical conditions
- Target values
- Required quantities
- Scenario parameters

```text
Same Concept
     ↓
Different Parameters
     ↓
Different Challenge
     ↓
Same Learning Objective
```

---

# 🤖 AI Learning Insight Service

NEXUS adds a generative AI layer after the adaptive learning decision.

```text
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
```

The AI acts as a learning assistant rather than the authority over the game.

---

# 💬 AI Learning Insights

After an attempt, the structured Learning Event can be sent to the AI insight service.

The service can provide:

- Mistake explanations
- Conceptual clarification
- Learning-pattern analysis
- Personalized feedback
- Practice recommendations
- Session-level insights

Instead of simply showing:

> **Wrong Answer**

NEXUS can explain what the learner may have misunderstood and what concept should be reviewed.

---

# 🔍 Personalized Mistake Analysis

NEXUS uses structured learning events so that AI insights can be based on actual learner attempts.

The AI can receive contextual information such as:

```text
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
```

This provides substantially more context than an isolated question-and-answer pair.

```text
Question
   +
Current Attempt
   +
Previous Attempt Context
   +
Concept Mastery
   ↓
Personalized Insight
```

---

# 🧾 Learning Events

A **Learning Event** acts as the common representation between the game, adaptive engine, session history, and AI insight service.

A typical event contains:

```json
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
```

The event captures the learning state at the time of the attempt.

---

# 🔗 Session History

NEXUS maintains session-level learning history for recorded attempts.

```text
Attempt
   ↓
Learning Event
   ↓
Session History
   ↓
AI Insight
   ↓
Insight Attached to Attempt
```

Each attempt receives an identifier so that an asynchronously generated AI insight can be associated with the exact attempt that produced it.

---

# 💾 Insight Persistence

The AI response is associated with the corresponding session attempt.

```text
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
```

This allows the AI Insights page to display insights generated from actual learning attempts.

---

# 🛡️ AI Responsibility Boundary

NEXUS deliberately separates deterministic learning decisions from generative AI.

| Responsibility | Adaptive Engine | AI |
|---|:---:|:---:|
| Correctness | ✅ | ❌ |
| Score | ✅ | ❌ |
| Mastery | ✅ | ❌ |
| Difficulty | ✅ | ❌ |
| Challenge Generation | ✅ | ❌ |
| Concept Progression | ✅ | ❌ |
| Module Progression | ✅ | ❌ |
| Explanations | ❌ | ✅ |
| Mistake Analysis | ❌ | ✅ |
| Learning Insights | ❌ | ✅ |
| Practice Recommendations | ❌ | ✅ |

This boundary ensures that an LLM response cannot directly determine the authoritative state of the learner.

---

# 🔐 AI Failure Handling

AI is an enhancement to the learning experience, not a dependency for the physics engine.

If the AI service is unavailable:

```text
Physics Game
     ↓
Attempt
     ↓
Adaptive Engine
     ↓
Mastery Update
     ↓
Next Challenge
```

The core learning loop can continue.

Failures in the AI or network layer do not block gameplay.

---

# 🌐 AI Provider Architecture

The NEXUS AI layer uses an OpenAI-compatible API interface.

The server-side environment contract is:

```env
LLM_API_KEY=your_api_key_here
LLM_BASE_URL=https://api.groq.com/openai/v1/chat/completions
LLM_MODEL=openai/gpt-oss-20b
```

The API key remains server-side and is never included in the client application.

### Runtime Flow

```text
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
```

---

# 🖥️ Product Experience

NEXUS is organized around the following product surfaces:

```text
                    NEXUS
                      │
       ┌──────────────┼──────────────┐
       ↓              ↓              ↓
   Dashboard         Play           Learn
       │              │              │
       └──────────────┼──────────────┘
                      ↓
              Progress / Insights
```

---

# 🏠 Dashboard

The Dashboard provides the learner with a high-level view of NEXUS.

It connects the learner to:

- Physics Labs
- Learning Journey
- Progress
- AI Learning Insights

The Physics Journey presents all eight Physics Labs as part of the NEXUS learning experience.

---

# 🎮 Play Hub

The Play section acts as the central entry point for the interactive Physics Labs.

The unified Physics Labs experience includes:

```text
Projectile Motion
Newton's Laws
Work & Energy
Momentum & Collisions
Circular Motion
Gravitation & Orbits
Wave Motion
Archimedes' Principle
```

Each lab launches its corresponding interactive experience.

---

# 📚 Learn

The Learn section provides the conceptual side of NEXUS.

Each module exposes its concepts so learners can review the underlying physics before or after experimentation.

The learning relationship becomes:

```text
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
```

The same curriculum concepts connect the learning material with the corresponding playable experience.

---

# 📈 Progress

The Progress experience focuses on the learner's current learning state and recorded activity.

NEXUS intentionally avoids fabricating long-term progress that has not actually been recorded.

Displayed progress is based on available session learning data and adaptive state.

---

# 🤖 AI Insights

The AI Insights page turns recorded learning attempts into understandable feedback.

It can surface:

- Recent AI explanations
- Mistake patterns
- Weak concepts
- Practice recommendations
- Session-level learning observations

The experience connects:

```text
Real Attempt
    ↓
Structured Learning Event
    ↓
AI Analysis
    ↓
Personalized Insight
    ↓
Recommended Practice
```

The learner therefore receives more than a numerical result.

---

# 🏗️ System Architecture

```text
┌──────────────────────────────────────────────┐
│              NEXUS WEB APPLICATION           │
│                                              │
│ Dashboard │ Play │ Learn │ Progress │ AI     │
│                                      Insights│
└──────────────────────────┬───────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────┐
│             PHYSICS GAME LAYER               │
│                                              │
│ Interactive Experiments │ Challenges         │
│ Simulation │ Controls │ Physics Calculations │
└──────────────────────────┬───────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────┐
│             ADAPTIVE ENGINE                  │
│                                              │
│ Mastery │ Difficulty │ Concepts              │
│ Challenge Generation │ Reinforcement         │
└──────────────────────────┬───────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────┐
│              LEARNING EVENT                  │
│                                              │
│ Attempt │ Performance │ Mastery │ Context    │
└───────────────────────┬──────────────────────┘
                        │
               ┌────────┴────────┐
               │                 │
               ▼                 ▼
      Next Adaptive          AI Insight
        Challenge              Service
                                  │
                                  ▼
                            LLM Provider
                                  │
                                  ▼
                       Personalized Insight
                                  │
                                  ▼
                         Session History
```

---

# 🔄 Runtime Workflow

```text
1. Learner opens NEXUS
              ↓
2. Learner selects a Physics Lab
              ↓
3. Adaptive challenge is generated
              ↓
4. Learner interacts with simulation
              ↓
5. Experiment / answer is completed
              ↓
6. Physics engine evaluates the result
              ↓
7. Adaptive Engine updates mastery
              ↓
8. Learning Event is generated
              ↓
        ┌─────┴─────┐
        ↓           ↓
Next Challenge   AI Insight
                    ↓
             Personalized Feedback
                    ↓
             Session History
                    ↓
               AI Insights
```

---

# 🧩 Architecture Principles

## Deterministic Adaptation

The Adaptive Engine owns authoritative learning decisions.

## AI as a Downstream Service

The AI interprets learning events but does not control game state.

## Physics First

Correctness originates from the physics implementation rather than the language model.

## Concept-Level Learning

Mastery is tracked around concepts rather than only using one global score.

## Graceful AI Failure

The core learning loop does not depend on successful AI generation.

## Structured Learning Data

Learning Events provide a common representation shared by the game, adaptive engine, session history, and AI service.

---

# 🧰 Technology Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

## Game & Physics

- TypeScript
- Interactive 2D physics simulations
- Canvas-based game experiences
- Deterministic challenge generation
- Module-specific physics engines

## Adaptive Learning

- Custom Adaptive Engine
- Concept mastery tracking
- Difficulty adaptation
- Challenge generation
- Learning Event pipeline

## AI

- Server-side AI Insight API
- OpenAI-compatible API interface
- Groq
- `openai/gpt-oss-20b`

## Deployment

- GitHub
- Vercel

---

# 📁 Project Structure

The repository is organized around the game engine, shared learning architecture, and web application.

```text
NEXUS/
│
├── game-2d/
│   └── src/
│       ├── adaptiveEngine.ts
│       ├── learningEventPipeline.ts
│       ├── learningEventPipeline.test.ts
│       ├── GameCanvas.tsx
│       ├── HowToPlay.tsx
│       ├── gravitationPhysics.ts
│       ├── gravitationChallenge.ts
│       ├── gravitationLearning.ts
│       ├── gravitationRender.ts
│       ├── GravitationScene.tsx
│       ├── GravitationChallengeScene.tsx
│       ├── wavesPhysics.ts
│       ├── wavesChallenge.ts
│       ├── wavesRender.ts
│       ├── WavesScene.tsx
│       ├── WavesChallengeScene.tsx
│       ├── archimedesPhysics.ts
│       ├── archimedesChallenge.ts
│       ├── archimedesLearning.ts
│       ├── archimedesRender.ts
│       ├── ArchimedesScene.tsx
│       ├── ArchimedesChallengeScene.tsx
│       └── ...
│
├── shared/
│   └── src/
│       ├── curriculum.ts
│       ├── insight.ts
│       └── sessionHistory.ts
│
├── web-2d/
│   ├── src/
│   │   ├── app/
│   │   └── components/
│   └── ...
│
├── .gitignore
├── package.json
└── README.md
```

---

# 🔐 Environment Variables

Create:

```text
web-2d/.env.local
```

and configure:

```env
LLM_API_KEY=your_api_key_here
LLM_BASE_URL=https://api.groq.com/openai/v1/chat/completions
LLM_MODEL=openai/gpt-oss-20b
```

### Security

- Never commit the API key.
- Keep `.env.local` ignored by Git.
- Never expose the API key to the browser.
- Access LLM credentials only from server-side code.
- Configure production credentials through the deployment platform.

---

# 💻 Local Development

## 1. Clone the repository

```bash
git clone https://github.com/Anumeha600/NEXUS.git
cd NEXUS
```

## 2. Install dependencies

```bash
cd web-2d
npm install
```

## 3. Configure environment variables

Create:

```text
.env.local
```

and add:

```env
LLM_API_KEY=your_api_key_here
LLM_BASE_URL=https://api.groq.com/openai/v1/chat/completions
LLM_MODEL=openai/gpt-oss-20b
```

## 4. Start the development server

```bash
npm run dev
```

## 5. Open NEXUS

```text
http://localhost:3000
```

### Main Routes

```text
/
 /play
 /learn
 /progress
 /insights
```

Physics Labs are launched through the Play Hub and corresponding module routes.

---

# 🧪 Testing

NEXUS includes automated tests covering multiple layers of the system.

These include:

- Physics calculations
- Challenge generation
- Adaptive learning
- Mastery behavior
- Learning events
- Learning-event pipeline
- Module-specific behavior

The latest verified project state recorded:

```text
603 / 603 tests passing
0 failures
```

Additional validation:

```text
Typecheck  → PASS
Lint       → PASS
Build      → PASS
```

The project also performs server-level route verification for the available Physics Lab routes.

---

# ☁️ Deployment

NEXUS is deployed using Vercel.

### Production URL

```text
https://nexus-web-2d.vercel.app/
```

### GitHub Repository

```text
https://github.com/Anumeha600/NEXUS
```

The web application is deployed from:

```text
web-2d
```

### Required Production Environment Variables

```text
LLM_API_KEY
LLM_BASE_URL
LLM_MODEL
```

The API key must be configured through Vercel environment variables and must never be committed to GitHub.

---

# 🔒 Security & Reliability

NEXUS follows a server-side AI architecture.

The browser does not directly receive the LLM API credential.

```text
Client
  ↓
NEXUS Server
  ↓
AI Insight API
  ↓
LLM Provider
```

The core learning system is also independent of AI availability.

If AI generation fails:

```text
AI Failure
   ↓
Gameplay Continues
   ↓
Adaptive Engine Continues
```

This prevents the external AI provider from becoming a single point of failure for the core physics learning experience.

---

# 🎬 Recommended Hackathon Demo Flow

The following flow demonstrates the complete NEXUS concept quickly.

## Step 1 — Open NEXUS

Open:

```text
https://nexus-web-2d.vercel.app/
```

Show the Dashboard and the eight Physics Labs.

---

## Step 2 — Open Play

Navigate to:

```text
Play
```

Show the unified Physics Labs grid.

Highlight that NEXUS contains:

```text
Projectile Motion
Newton's Laws
Work & Energy
Momentum & Collisions
Circular Motion
Gravitation & Orbits
Wave Motion
Archimedes' Principle
```

---

## Step 3 — Choose an Interactive Lab

Select a visually engaging lab.

Recommended demonstrations include:

- Projectile Motion
- Momentum & Collisions
- Circular Motion
- Gravitation
- Wave Motion
- Archimedes' Principle

---

## Step 4 — Demonstrate the Physics

Show that the learner interacts with an actual simulation rather than a static question.

Explain the relationship:

```text
Formula
   ↓
Parameters
   ↓
Simulation
   ↓
Observable Physics
```

---

## Step 5 — Complete a Challenge

Submit a numerical, conceptual, or simulation-based challenge.

---

## Step 6 — Explain Adaptation

Show that the attempt becomes a structured learning signal.

```text
Attempt
   ↓
Performance
   ↓
Mastery
   ↓
Adaptive Engine
   ↓
Next Challenge
```

---

## Step 7 — Demonstrate AI Learning Insights

Navigate to:

```text
AI Insights
```

Show the generated explanation and practice recommendation.

Explain that the AI is analyzing the learning event rather than controlling the adaptive engine.

---

## Step 8 — Explain the Architecture

Show:

```text
Physics Game
      ↓
Adaptive Engine
      ↓
Learning Event
      ↓
AI Insight
```

Then explain the responsibility boundary:

```text
Adaptive Engine
→ Correctness
→ Mastery
→ Difficulty
→ Progression

AI
→ Explanation
→ Mistake Analysis
→ Learning Insights
→ Recommendations
```

---

## Step 9 — Show the Breadth

Return to the Play Hub and show all eight Physics Labs.

---

## Step 10 — End With the Core Idea

> **Every attempt is not just an answer. It is a learning signal.**

---

# 🏆 Why NEXUS?

## Interactive Physics

Learners observe physical behavior instead of only reading formulas.

## Adaptive Learning

Difficulty and challenge generation respond to learner performance.

## Concept-Level Mastery

The system distinguishes between different concepts instead of reducing physics to one global score.

## Deterministic Intelligence

The authoritative adaptive state is controlled by a deterministic engine.

## Generative AI

AI provides natural-language explanations and personalized learning insights.

## Eight Playable Labs

The platform covers eight different physics domains.

## Learning Event Architecture

Every attempt becomes structured learning data that can support both adaptation and explanation.

---

# 📈 Potential Impact

The architecture demonstrated by NEXUS can be extended beyond physics.

The same learning architecture can be applied to:

- Mathematics
- Programming
- Chemistry
- Electronics
- Engineering fundamentals
- STEM laboratory simulations

The general pattern is:

```text
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
```

The current physics implementation provides a foundation for demonstrating this broader adaptive-learning architecture.

---

# 🔮 Future Scope

## Persistent Learner Profiles

Move beyond session-level learning and maintain longer-term learner progress.

## Expanded Mastery Analytics

Track concept mastery across multiple sessions and learning periods.

## Teacher / Instructor Dashboard

Allow educators to view learner progress and identify concepts requiring additional attention.

## More Subjects

Extend the adaptive architecture to:

- Mathematics
- Coding
- Chemistry
- Electronics
- Other STEM subjects

## Richer Physics Simulations

Introduce more complex physical environments and experimental scenarios.

## Advanced AI Tutoring

Provide deeper conversational explanations while keeping authoritative correctness and progression outside the LLM.

## Classroom Deployment

Support larger groups of learners with instructor-facing analytics and structured learning data.

---

# 🔒 Safety & AI Responsibility

NEXUS intentionally keeps authoritative learning decisions outside the generative AI model.

The AI is not used to decide whether the learner's physics answer is correct.

It is not used to directly modify:

- Score
- Mastery
- Difficulty
- Challenge generation
- Concept progression
- Module progression

Instead:

```text
Physics Engine
      ↓
Authoritative Result
      ↓
Adaptive Engine
      ↓
Learning Event
      ↓
AI Insight
```

This keeps the core learning system deterministic while still benefiting from generative AI.

---

# ⚠️ Prototype Disclaimer

NEXUS is a **hackathon prototype** designed to demonstrate an adaptive-learning architecture through interactive physics simulations.

The current implementation focuses on demonstrating:

- Interactive physics learning
- Deterministic adaptation
- Concept-level mastery
- Structured learning events
- AI-generated learning insights
- Personalized practice feedback

The system should therefore be treated as a prototype rather than a replacement for formal classroom instruction, assessment systems, or professional educational evaluation.

---

# 🏁 Hackathon

**Bit N Build – Around the World 2026**

### Problem Statement

**PSN018 – AI-Powered Adaptive Learning Game**

The challenge asks teams to:

> Design a game that adjusts its difficulty and content in real time based on a player's performance, turning a school subject into a personalized, engaging learning loop.

NEXUS addresses this through an interactive physics environment where learner performance becomes the signal that drives the next learning experience.

---

# 👥 Team

## Team NEXUS

NEXUS was developed as a hackathon project for:

**Bit N Build – Around the World 2026**

---

# 🌐 Links

### Live Demo

https://nexus-web-2d.vercel.app/

### GitHub Repository

https://github.com/Anumeha600/NEXUS

---

# 💭 Core Idea

Traditional learning asks:

> **"What question should the student answer next?"**

NEXUS asks:

> **"What does this student's performance tell us about what they should experience next?"**

The system transforms:

```text
Question
   ↓
Answer
```

into:

```text
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
```

> **NEXUS turns physics from a sequence of questions into an adaptive learning experience where every attempt becomes a signal for what the learner should experience next.**
