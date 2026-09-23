# Industrial Three-Pass Wet-Back Steam Boiler: 3D CAD & Thermodynamic Simulation

An interactive, high-fidelity 3D volumetric CAD simulation of an **Industrial Three-Pass Wet-Back Fire-Tube Steam Boiler Plant** featuring real-time thermodynamic simulation, full SCADA operator console, dual-fuel modulating burner, atmospheric feedwater tank with centrifugal feedpump, and a steam distribution loop with plate heat exchangers and condensate recovery.

Built according to **ASME Boiler & Pressure Vessel Code (BPVC) Section I / EN 12953 / ASME CSD-1**.

---

## 🌟 Key Features

* **Complete 3D CAD Engineering Cutaway (`scene3d.js`):**
  * **Pass 1 (Corrugated Furnace Tube):** Morison-pattern corrugated tube absorbing high radiative heat flux while accommodating thermal expansion.
  * **Wet-Back Reversal Chamber:** Submerged combustion chamber completely surrounded by water on all sides, eliminating refractory deterioration and tube sheet thermal cracking.
  * **Pass 2 Fire-Tube Bundles:** Submerged convective tube banks guiding flue gases forward to the front smoke box.
  * **Front Smoke Box:** Flanged gas turnaround casing with double-hinged inspection doors.
  * **Pass 3 Fire-Tube Bundles:** Upper convective tubes transferring flue gas rearward to the exhaust collector.
  * **Flue Gas Economizer:** Helical copper coil inside the exhaust stack preheating incoming feedwater from $60^\circ\text{C}$ to $92^\circ\text{C}$ ($>89\%$ thermal efficiency).
* **Auxiliary Plant Systems:**
  * **Atmospheric Feedwater Tank:** Atmospheric open-vented feedtank with make-up float valve and hot condensate return inlet.
  * **Centrifugal Boiler Feedpump:** Base-mounted pump delivering preheated water against boiler operating pressure.
  * **Steam Distribution System:** Distribution manifold, steam separator, plate heat exchanger, thermodynamic steam traps, and a complete floor-level condensate return line.
  * **Foundation & Bottom Manifolds:** Heavy fabricated steel I-beam skid, cradle saddle supports, and quick-opening bottom blowdown valve with purge piping.
* **Camera Navigation & Full Views:**
  * **📐 Full Plant View:** Complete overview of the boiler, feedtank, and steam distribution layout.
  * **📐 Full Bottom View:** Specialized underside view capturing the foundation skid, blowdown piping, feedpump base, and condensate return lines.
  * **Clean Mode:** Full View automatically hides all SCADA cards and write-ups, displaying only the 3D model. Press **`H`** or click **`Show Write-Up`** anytime to toggle panels.
  * **3D Exploded Assembly System:** Animated mechanical explosion trajectories with an interactive 0%–100% slider.
  * **X-Ray / Transparent Shell Mode:** Translucent shell cutaway revealing internal tubes, wet-back, and fluid flows.
* **Real-Time Thermodynamics & SCADA Control (`physics.js`, `app.js`):**
  * Real-time $P_{sat} \leftrightarrow T_{sat}$ steam generation physics based on Antoine equations.
  * Dynamic mass & energy balances across firing rate, steam demand, and feedwater makeup.
  * Safety interlocks: Low Water Cutoff (LWCO lockout at $-50\,\text{mm}$), high water alarm, dual safety relief valves popping at $10.5\,\text{bar}$.
* **Volumetric Particle Visuals (`particles.js`):**
  * Modulating burner flame (Natural Gas or Heavy Oil).
  * 3-Pass heat flow streamlines tracking flue gas path.
  * Submerged nucleate boiling micro-bubbles rising through fire tubes.
  * Safety valve high-velocity steam discharge plumes.
* **Procedural Web Audio Engine (`audio.js`):**
  * Realistic combustion roar, steam hiss through the crown valve, safety valve pop roar, and piezo alarms.

---

## 🚀 Quick Start

This application is completely self-contained with no external build step required.

1. Clone or download this repository.
2. Serve the directory with any local HTTP server:
   ```bash
   # Using Python
   python -m http.server 8080

   # Or using Node.js
   npx serve .
   ```
3. Open `http://localhost:8080` in any modern web browser (Chrome, Edge, Firefox, Safari).

---

## 🛠️ Tech Stack

* **Three.js (r128)** — 3D procedural CAD mesh generation, materials, shadows, and orbit controls.
* **Tailwind CSS** — SCADA HMI styling and responsive dashboard overlays.
* **Web Audio API** — Synthetic real-time sound effects for burner combustion and steam flow.
* **Vanilla JavaScript** — High-performance thermodynamic solver and state synchronization.

---

## 📜 Standards & References

* **ASME BPVC Section I** — Rules for Construction of Power Boilers
* **BS EN 12953** — Shell Boilers (Parts 1–11)
* **ASME CSD-1** — Controls and Safety Devices for Automatically Fired Boilers
* **NFPA 85** — Boiler and Combustion Systems Hazards Code
