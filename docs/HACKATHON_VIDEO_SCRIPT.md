# Awwaz.ai — Hackathon Winning Demo Video Production Pack

---

## 1. Master Prompt to Send to Claude

Copy and paste the exact block below into Claude to generate Remotion code, slide assets, or video automation scripts:

```text
You are an expert video producer and frontend engineer specializing in winning YC/hackathon product demo videos.

I need a complete, production-ready video script and automation plan for "Awwaz.ai", an autonomous civic operations platform that converts messy citizen reports (Urdu, Roman Urdu, English) into verified municipal actions with SLA stall detection and a SHA-256 cryptographic audit chain.

Target length: 150 to 180 seconds (2.5 to 3 minutes).
Style: Stripe/Linear aesthetic, punchy pace, high-contrast typography, crisp UI captures.

Please provide:
1. A timed scene-by-scene script with exact Voiceover (VO), On-Screen Actions, Captions, and UI state references.
2. If using Remotion/React-based video generation: Provide the component structure, animations, and typography tokens.
3. Direct instructions for screen recording, ElevenLabs voiceover generation, and assembly in CapCut/Premiere.
```

---

## 2. Timed Scene-by-Scene Video Script (180 Seconds)

### **Act 1: The Problem (0:00 – 0:25)**

* **Visuals**: Dark opening canvas. Red alert badge flashing `STATUS: UNANSWERED (14 DAYS)`. Rapid montage of broken municipal portals, drop-down menus with 40 fields, and citizen frustration.
* **On-Screen Text**: *"Existing systems collect complaints. Awwaz guarantees action."*
* **Audio / SFX**: Sub bass drop, subtle typing ticking.
* **Voiceover (VO)**:
  > "Every year, millions of civic complaints disappear into digital black holes. Citizens file tickets, get automated ticket numbers, and hear nothing for weeks. Why? Because municipal software was built for logging bureaucracy—not driving real-world resolution. We built Awwaz to fix what happens next."

---

### **Act 2: The Citizen Intake Experience (0:25 – 0:55)**

* **Visuals**: Switch to `http://localhost:3000/citizen`. Clean white Stripe-grade interface. Cursor clicks the mic button, waveform pulses.
* **On-Screen Action**:
  1. Citizen enters message in Roman Urdu: `"Bhai 3 din se G-9 markaz me gutter overflow ho raha hai aur ganda pani dukanon me ghus raha hai."`
  2. AI responds instantly (<2s), extracts location (`Sector G-9 Markaz`), categorizes as `WATER_DRAINAGE (WASA)`, and provides tracking link `Case #A1024`.
  3. One-click upload of a photo showing field conditions.
* **Captions**: *Zero Registration Hurdles • Urdu / Roman Urdu / English NLP • Instant Case Routing*
* **Voiceover (VO)**:
  > "Meet Tariq. He speaks Roman Urdu. No portals, no account logins. He types or speaks naturally. Within two seconds, Awwaz parses his intent, normalizes the location, attaches photo evidence, routes it directly to WASA Drainage, and returns an append-only tracking docket."

---

### **Act 3: The Autonomous Sentinel & Stall Detection (0:55 – 1:25)**

* **Visuals**: Transition to `http://localhost:3000/dashboard`. High-density operator triage console with real-time KPI cards.
* **On-Screen Action**:
  1. Highlight the `Stalled (>72h)` card flashing amber.
  2. Open Case `#A1024`. Timeline reveals no updates for 74 hours.
  3. AI Evaluator autonomously generates a grounded escalation recommendation citing verifiable facts.
* **Captions**: *Autonomous 72h Sentinel • Zero Hallucinations • Grounded Fact Citations*
* **Voiceover (VO)**:
  > "Here is where traditional software dies and Awwaz takes over. If a department leaves a case idle for over 72 hours, Awwaz's background sentinel detects the stall. It doesn't hallucinate. It extracts verified timestamps and synthesizes a grounded recommendation to escalate to the Executive Engineer."

---

### **Act 4: Human-in-the-Loop Authority & Civic Adapter (1:25 – 1:55)**

* **Visuals**: Navigate to `http://localhost:3000/dashboard/approvals`.
* **On-Screen Action**:
  1. Officer Fatima reviews the recommendation.
  2. Clicks `Review & Authorize Action`.
  3. A clean in-app modal opens with verified grounding facts and operator notes.
  4. Clicks `Confirm & Execute Escalation`. Success toast fires: `"External Civic Reference: CIVIC-ESC-A1024-WASA generated."`
* **Captions**: *Strict Security Boundary • Human-Authorized Action • Adapter API Dispatched*
* **Voiceover (VO)**:
  > "Crucially, Awwaz enforces strict human authority. Autonomous agents cannot trigger real-world government machinery without human authorization. Fatima reviews the evidence, approves the dispatch with one click, and the Civic Service Adapter pushes the ticket upstream."

---

### **Act 5: Cryptographic Integrity & Closing (1:55 – 2:30)**

* **Visuals**: Navigate to `http://localhost:3000/admin`. Zoom into the Cryptographic Ledger Integrity card showing sequential SHA-256 block verification. End on clean landing page showing the live stats strip.
* **On-Screen Action**:
  1. Click `Re-Verify Chain`. Green badge pulses: `CHAIN VALID (18 Blocks)`.
  2. Final hero screen with GitHub repo link and demo credentials.
* **Captions**: *SHA-256 Sequential Hash Chain • Tamper-Proof Audit Trail • Production Ready*
* **Voiceover (VO)**:
  > "Every single action—from the citizen's voice note to the operator's sign-off—is anchored into an immutable SHA-256 cryptographic ledger. Tamper-evident, auditable, and production-tested with 100% test coverage. Awwaz doesn't just log complaints—it guarantees civic accountability. Thank you."

---

## 3. How to Produce the Video (Step-by-Step)

### Option A: Screen Recording + AI Voice (Fastest & Highest Fidelity)

1. **Generate Voiceover**:
   - Open [ElevenLabs](https://elevenlabs.io) or OpenAI TTS.
   - Select a crisp, energetic voice (e.g., ElevenLabs "Adam", "Brian", or "Marcus").
   - Paste the voiceover text from Acts 1 through 5.
   - Export as high-quality WAV/MP3.

2. **Record Screen Clips**:
   - Set browser display to 1920×1080 (16:9).
   - Ensure local dev server is running (`http://localhost:3000`).
   - Use CleanShot X, OBS Studio, or QuickTime.
   - Record the 5 exact sequences detailed in the script above.

3. **Assemble in CapCut / Premiere / DaVinci**:
   - Place Voiceover on Audio Track 1.
   - Align screen recordings to voiceover cues.
   - Add zoom cuts (115% zoom into modal popups and status pills).
   - Add subtle background tech ambient audio (5-8% volume).
   - Export at 1080p60 or 4K.

---

### Option B: Remotion Video Code Automation

If you prefer programmatic video generation via React/Remotion, ask Claude:
```text
Convert the Awwaz hackathon script into a Remotion composition.
Use @remotion/player, Tailwind/Vanilla CSS tokens matching Awwaz (#09090b, #2563eb, #10b981), and animate screenshots using spring() interpolations.
```
