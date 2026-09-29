<img width="720" height="450" alt="nexus_demo_snippet" src="https://github.com/user-attachments/assets/eb0e9df1-8923-40f8-b36f-71d3e962c4d8" />




# NEXUS

### AI-Powered Adaptive Physics Learning Game

**Learn Physics by experimenting.**

**Hackathon:** Bit N Build – Around the World 2026  
**Problem Statement:** PSN018 – AI-Powered Adaptive Learning Game

🌐 **Live Demo:** https://nexus-web-2d.vercel.app/  
📦 **GitHub:** https://github.com/Anumeha600/NEXUS

---

## 🚀 Overview

**NEXUS** is an AI-powered adaptive Physics learning game that turns every student attempt into a signal for what to learn next.

Instead of giving every learner the same fixed sequence of questions, NEXUS combines interactive Physics simulations, concept-level mastery tracking, adaptive challenge generation, and AI-powered learning insights.

```text
PLAY
  ↓
PERFORM
  ↓
ADAPT
  ↓
UNDERSTAND
  ↓
PLAY AGAIN
```

---

## 🎯 Problem Statement

Traditional digital learning often relies on:

- Fixed question sequences
- Static difficulty
- Generic feedback
- Limited concept-level adaptation
- Formula-based learning without enough experimentation

A student may understand one concept while struggling with another, but a fixed learning path does not always respond to that difference.

### NEXUS Solution

NEXUS continuously uses learner performance to determine what should happen next.

```text
Interactive Experiment
        ↓
Student Attempt
        ↓
Adaptive Engine
        ↓
Learning Event
        ↓
Next Challenge + AI Insight
```

---

## 🎮 Key Features

- 🧪 **Interactive 2D Physics Simulations**
- 🧠 **Deterministic Adaptive Learning Engine**
- 🎯 **Concept-Level Mastery Tracking**
- 🔄 **Adaptive Challenge Generation**
- 🤖 **AI-Powered Learning Insights**
- 💬 **Personalized Mistake Analysis**
- 📊 **Session-Based Progress Tracking**
- 🌐 **Production Web Deployment**
- 🔬 **8 Playable Physics Labs**

---

## 🌌 Physics Labs

NEXUS currently includes **8 interactive Physics Labs**:

| Lab | Concepts |
|---|---|
| 🏹 Projectile Motion | Range, velocity, gravity |
| ⚙️ Newton's Laws | Force, acceleration, net force, friction |
| ⚡ Work & Energy | Work, kinetic energy, energy transfer |
| 💥 Momentum & Collisions | Momentum, impulse, conservation |
| 🔄 Circular Motion | Centripetal force, acceleration, speed |
| 🌍 Gravitation & Orbits | Gravity, orbital velocity, escape velocity |
| 🌊 Wave Motion | Amplitude, frequency, wavelength, superposition |
| 💧 Archimedes' Principle | Buoyancy, apparent weight, density |

Each lab uses the same adaptive-learning architecture while providing its own Physics simulation and challenges.

---

## 🧠 Adaptive Learning Engine

The Adaptive Engine is the authoritative learning system in NEXUS.

It evaluates learner performance and updates concept mastery to determine the next challenge.

### Performance Model

```text
Performance =
    0.6 × Accuracy
  + 0.3 × Success
  + 0.1 × Speed
```

### Learning Loop

```text
Student Attempt
      ↓
Performance Evaluation
      ↓
Mastery Update
      ↓
Concept State
      ↓
Adaptive Difficulty
      ↓
Next Challenge
```

The engine supports:

- Concept-level mastery
- Difficulty adaptation
- Weak-concept reinforcement
- Deterministic challenge generation
- Concept progression

There is no manual Easy / Medium / Hard selector. The learner's performance drives the experience.

---

## 🤖 AI Learning Insights

NEXUS uses generative AI **after** the adaptive engine has evaluated an attempt.

A structured Learning Event is passed to the AI insight service, which can generate:

- Personalized explanations
- Mistake analysis
- Learning-pattern insights
- Concept clarification
- Practice recommendations

```text
Physics Game
      ↓
Adaptive Engine
      ↓
Learning Event
      ↓
AI Insight Service
      ↓
LLM Provider
      ↓
Personalized Feedback
```

AI insights are attached to the corresponding learning attempt and can be viewed through the **AI Insights** section.

---

## 🛡️ AI Responsibility Boundary

The AI does **not** control the authoritative learning state.

| Adaptive Engine | AI |
|---|---|
| Correctness | Explanations |
| Score | Mistake Analysis |
| Mastery | Learning Insights |
| Difficulty | Recommendations |
| Challenge Generation | Pattern Identification |
| Progression | Personalized Feedback |

> **The Adaptive Engine decides. AI explains.**

This keeps the core learning system deterministic while using generative AI where it adds value.

---

## 🏗️ System Architecture

```text
┌──────────────────────────────────┐
│          NEXUS WEB APP           │
│ Dashboard / Play / Learn         │
│ Progress / AI Insights           │
└───────────────┬──────────────────┘
                ↓
┌──────────────────────────────────┐
│        PHYSICS GAME LAYER        │
│ Simulations / Challenges         │
│ Physics Calculations             │
└───────────────┬──────────────────┘
                ↓
┌──────────────────────────────────┐
│         ADAPTIVE ENGINE          │
│ Mastery / Difficulty / Progress  │
└───────────────┬──────────────────┘
                ↓
┌──────────────────────────────────┐
│         LEARNING EVENT           │
└───────────────┬──────────────────┘
                │
          ┌─────┴─────┐
          ↓           ↓
   Next Challenge   AI Insight
                       ↓
                  LLM Provider
                       ↓
               Personalized Feedback
```

---

## 🧾 Learning Events

Every completed attempt can be represented as a structured Learning Event containing information such as:

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
Context
```

This common structure connects:

**Game → Adaptive Engine → Session History → AI Insights**

---

## 🛠️ Technology Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Game & Physics

- TypeScript
- 2D interactive simulations
- Canvas-based game experiences
- Module-specific Physics engines

### Adaptive Learning

- Custom Adaptive Engine
- Concept mastery tracking
- Adaptive difficulty
- Challenge generation
- Learning Event pipeline

### AI

- Server-side AI Insight API
- OpenAI-compatible API interface
- Groq
- `openai/gpt-oss-20b`

### Deployment

- GitHub
- Vercel

---

## 📁 Project Structure

```text
NEXUS/
│
├── game-2d/
│   └── src/
│       ├── adaptiveEngine.ts
│       ├── learningEventPipeline.ts
│       ├── GameCanvas.tsx
│       ├── HowToPlay.tsx
│       ├── gravitation*
│       ├── waves*
│       ├── archimedes*
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
│       └── components/
│
└── README.md
```

---

## 🔐 Environment Variables

Create:

```text
web-2d/.env.local
```

```env
LLM_API_KEY=your_api_key_here
LLM_BASE_URL=https://api.groq.com/openai/v1/chat/completions
LLM_MODEL=openai/gpt-oss-20b
```

**Never commit API keys to GitHub.**

For production, configure these values through Vercel Environment Variables.

---

## 💻 Local Development

### Clone

```bash
git clone https://github.com/Anumeha600/NEXUS.git
cd NEXUS
```

### Install

```bash
cd web-2d
npm install
```

### Run

```bash
npm run dev
```

Open:

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

---

## 🧪 Testing

The project includes automated tests for:

- Physics calculations
- Challenge generation
- Adaptive learning
- Mastery behavior
- Learning Events
- AI learning-event pipeline
- Module-specific functionality

Latest verified state:

```text
603 / 603 tests passing
Typecheck  ✓
Lint       ✓
Build      ✓
```

---

## ☁️ Deployment

NEXUS is deployed on **Vercel**.

### Live Application

https://nexus-web-2d.vercel.app/

### Repository

https://github.com/Anumeha600/NEXUS

The production application uses server-side environment variables for the AI integration.

---

## 🎬 Demo Flow

A recommended demonstration:

```text
Dashboard
   ↓
Choose Physics Lab
   ↓
Start Adaptive Challenge
   ↓
Interact With Simulation
   ↓
Complete Attempt
   ↓
Adaptive Engine Updates Mastery
   ↓
Learning Event Created
   ↓
AI Generates Personalized Insight
   ↓
AI Insights Page
```

The demo should highlight both sides of NEXUS:

**Interactive Physics + Adaptive Intelligence**

---

## 📈 Validation

NEXUS has been validated through automated testing and production deployment.

### Current Implementation

- **8** Physics Labs
- **603/603** automated tests passing
- Deterministic Adaptive Engine
- AI Learning Insight pipeline
- Session-based learning history
- Production Vercel deployment

---

## 🔮 Future Scope

- Persistent learner profiles
- Long-term mastery tracking
- Teacher / instructor dashboard
- More STEM subjects
- Richer Physics simulations
- Advanced AI tutoring
- Classroom deployment
- Cross-session personalized learning

---

## 🏁 Hackathon

**Bit N Build – Around the World 2026**

**Problem Statement:**  
**PSN018 – AI-Powered Adaptive Learning Game**

NEXUS addresses the challenge by turning Physics into an interactive learning loop where player performance influences the next learning experience.

---

## 🔗 Links

🌐 **Live Demo:**  
https://nexus-web-2d.vercel.app/

📦 **GitHub:**  
https://github.com/Anumeha600/NEXUS

---

# 💭 Core Idea

Traditional learning asks:

> **"What question should the student answer next?"**

NEXUS asks:

> **"What does this student's performance tell us about what they should experience next?"**

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

### **Every attempt is not just an answer. It is a learning signal.**

**NEXUS — Learn Physics by Experimenting.**
