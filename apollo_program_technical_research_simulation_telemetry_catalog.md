# NASA Apollo Program Engineering Telemetry & Simulation Catalog (`sim-core` & `shared-schema`)

**Document ID:** `NASA-APOLLO-SIM-2026-REV1`  
**Primary Archival Sources:** NASA SP-4029 (*Apollo by the Numbers*), Saturn V Flight Evaluation Reports (`AS-506`, `AS-507`, `AS-508`, `AS-510`, `AS-512`), Apollo Operations Handbooks (`CSM Block II` & `LM-5` through `LM-12`), NASA Technical Reports Server (`NTRS`), Goddard Space Flight Center (`GSFC`) Unified S-Band & Trajectory Archives, and NASA Space Apps Challenge 2026 (*Space Mission Design Game*) Open Mission Design Reference Datasets.

---

## Module 1: Launch Vehicle & Ascent Envelope (Scenes 1–4)

### 1.1 Saturn V Stage-by-Stage Engineering Specifications

Data below reflects flight-verified telemetry across **AS-506 (Apollo 11 — G-Series)** and **AS-510 / AS-512 (Apollo 15 & 17 — J-Series Uprated Configuration)**, incorporating J-Series structural lightweighting, F-1/J-2 mixture ratio optimization, and lower Earth parking orbit insertion.

| Stage / Parameter | S-IC (Stage 1) | S-II (Stage 2) | S-IVB (Stage 3) | Instrument Unit (IU) + SLA |
| :--- | :--- | :--- | :--- | :--- |
| **Propulsion System** | $5 \times \text{Rocketdyne F-1}$ | $5 \times \text{Rocketdyne J-2}$ | $1 \times \text{Rocketdyne J-2}$ | Passive Guidance & Adapter |
| **Propellants (Oxidizer / Fuel)** | $\text{LOX} / \text{RP-1}$ | $\text{LOX} / \text{LH}_2$ | $\text{LOX} / \text{LH}_2$ | Cold-Gas $\text{N}_2$ Attitude Control |
| **Dry Mass — Apollo 11 ($\text{kg}$)** | $130,860\text{ kg}$ | $36,200\text{ kg}$ (+ $3,670\text{ kg}$ interstage) | $11,300\text{ kg}$ | $1,980\text{ kg}$ (IU) + $1,836\text{ kg}$ (SLA) |
| **Dry Mass — Apollo 17 J-Series ($\text{kg}$)** | $128,900\text{ kg}$ | $35,840\text{ kg}$ (+ $3,650\text{ kg}$ interstage) | $11,240\text{ kg}$ | $1,996\text{ kg}$ (IU) + $1,840\text{ kg}$ (SLA) |
| **Usable Propellant Mass — A-11 ($\text{kg}$)** | $2,077,000\text{ kg}$ | $443,200\text{ kg}$ | $106,900\text{ kg}$ | $0\text{ kg}$ |
| **Usable Propellant Mass — A-17 ($\text{kg}$)** | $2,149,500\text{ kg}$ | $451,700\text{ kg}$ | $108,800\text{ kg}$ | $0\text{ kg}$ |
| **Thrust at Sea Level ($\text{kN}$)** | $33,850\text{ kN}$ (A-11) / $34,340\text{ kN}$ (A-17) | $4,400\text{ kN}$ (ignited at $67.6\text{ km}$) | $\approx 486\text{ kN}$ (vacuum-only nozzle) | $0\text{ kN}$ |
| **Thrust in Vacuum ($\text{kN}$)** | $38,700\text{ kN}$ (A-11) / $39,260\text{ kN}$ (A-17) | $5,115\text{ kN}$ ($5.5:1$ O/F) / $4,450\text{ kN}$ ($4.8:1$ O/F) | $1,001\text{ kN}$ (A-11) / $1,023\text{ kN}$ (A-17) | $0\text{ kN}$ |
| **Specific Impulse $I_{sp}$ — Sea Level ($\text{s}$)** | $263.0\text{ s}$ | $200.0\text{ s}$ (theoretical) | $200.0\text{ s}$ (theoretical) | N/A |
| **Specific Impulse $I_{sp}$ — Vacuum ($\text{s}$)** | $304.0\text{ s}$ | $421.0\text{ s}$ (avg) / $426.0\text{ s}$ (peak) | $421.0\text{ s}$ (A-11) / $426.0\text{ s}$ (A-17) | N/A |
| **Nominal Burn Duration ($\text{s}$)** | $161.1\text{ s}$ (CECO $135.2\text{ s}$, OECO $161.1\text{ s}$) | $388.2\text{ s}$ (CECO $460.0\text{ s}$, OECO $549.3\text{ s}$) | Burn 1: $147.3\text{ s}$; Burn 2 (TLI): $347.3\text{–}351.0\text{ s}$ | N/A |
| **Stage Separation Altitude ($\text{km}$)** | $67.6\text{ km}$ ($36.5\text{ nmi}$) | $186.1\text{ km}$ ($100.5\text{ nmi}$) | EPO: $190.6\text{ km}$; TLI: $318.5\text{ km}$ | SLA jettison at TLI + $30\text{ min}$ |
| **Inertial Velocity at Cutoff ($\text{m/s}$)** | $2,756\text{ m/s}$ ($2,390\text{ m/s}$ Earth-rel) | $6,945\text{ m/s}$ | EPO: $7,791\text{ m/s}$; TLI: $10,835\text{ m/s}$ | $10,835\text{ m/s}$ |

---

### 1.2 Ascent Telemetry Milestones & Insertion Envelope

The fundamental ascent equation governing vehicle acceleration in `crates/sim-core` is:

$$a(t) = \frac{F_{\text{vac}} - P_{\text{amb}}(h) A_e - D(h, M)}{m(t)} - g(h)\sin\gamma$$

where dynamic pressure $q$ is evaluated at altitude $h$ and airspeed $v_{\text{rel}}$ via:

$$q = \frac{1}{2}\rho(h)v_{\text{rel}}^2$$

| Ascent Milestone / Parameter | Apollo 11 (`AS-506`) | Apollo 12 (`AS-507`) | Apollo 13 (`AS-508`) | Apollo 15 (`AS-510`) | Apollo 17 (`AS-512`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Gross Liftoff Mass (GLOM) ($\text{kg}$)** | $2,938,315\text{ kg}$ | $2,942,790\text{ kg}$ | $2,948,410\text{ kg}$ | $2,962,920\text{ kg}$ | $2,965,241\text{ kg}$ |
| **Liftoff Thrust-to-Weight Ratio ($\text{TWR}$)** | $1.174$ | $1.176$ | $1.175$ | $1.180$ | $1.181$ |
| **Time of Max-$Q$ ($\text{s}$ GET)** | $83.0\text{ s}$ | $83.4\text{ s}$ | $83.6\text{ s}$ | $84.0\text{ s}$ | $84.2\text{ s}$ |
| **Altitude at Max-$Q$ ($\text{km}$)** | $13.4\text{ km}$ | $13.5\text{ km}$ | $13.5\text{ km}$ | $13.7\text{ km}$ | $13.8\text{ km}$ |
| **Peak Dynamic Pressure $q_{\max}$ ($\text{kPa}$)** | $34.3\text{ kPa}$ | $34.6\text{ kPa}$ | $34.9\text{ kPa}$ | $35.5\text{ kPa}$ | $35.8\text{ kPa}$ |
| **EPO Perigee $\times$ Apogee ($\text{km}$)** | $183.2 \times 185.9\text{ km}$ | $185.0 \times 189.8\text{ km}$ | $185.2 \times 186.5\text{ km}$ | $169.5 \times 171.3\text{ km}$ | $168.9 \times 171.1\text{ km}$ |
| **EPO Inclination ($\text{deg}$)** | $32.52^\circ$ | $32.54^\circ$ | $32.55^\circ$ | $32.55^\circ$ | $28.52^\circ$ |
| **EPO Orbital Period ($\text{min}$)** | $88.18\text{ min}$ | $88.24\text{ min}$ | $88.20\text{ min}$ | $87.85\text{ min}$ | $87.84\text{ min}$ |
| **TLI Ignition Time ($\text{hh:mm:ss}$ GET)** | `02:44:16` | `02:47:23` | `02:35:46` | `02:50:01` | `03:12:36` |
| **TLI Burn Duration ($\text{s}$)** | $347.3\text{ s}$ | $341.1\text{ s}$ | $350.8\text{ s}$ | $350.7\text{ s}$ | $351.0\text{ s}$ |
| **TLI $\Delta v$ Imparted ($\text{m/s}$)** | $3,051.0\text{ m/s}$ | $3,042.5\text{ m/s}$ | $3,049.2\text{ m/s}$ | $3,046.8\text{ m/s}$ | $3,048.4\text{ m/s}$ |
| **Net TLI Spacecraft Mass ($\text{kg}$)** | $45,702\text{ kg}$ | $46,115\text{ kg}$ | $46,340\text{ kg}$ | $48,599\text{ kg}$ | $48,609\text{ kg}$ |

---

### 1.3 Alternative / Scaled Launch Vehicle Tiers

To give players strategic trade-offs between Earth-orbit qualification flights, standard lunar missions, and heavy direct-ascent or dual-payload architectures, three launch vehicle tiers are parameterized below (CPI inflation factor $8.55\times$ from 1969 USD to 2026 USD).

| Launch Vehicle Tier | Tier 1: Saturn IB (`AS-200`) | Tier 2: Saturn V (`AS-500` Baseline/J) | Tier 3: Uprated Saturn V-25(S) (`MLV-V-4(S)`) |
| :--- | :--- | :--- | :--- |
| **Mission Role** | LEO CSM/LM Test & Rendezvous | Standard & J-Series Lunar Landing | Heavy Lunar Cargo / Direct Ascent |
| **Stage 1 Configuration** | S-IB ($8 \times \text{H-1}$, $\text{LOX/RP-1}$) | S-IC ($5 \times \text{F-1}$, $\text{LOX/RP-1}$) | S-IC ($5 \times \text{F-1A}$) + $4 \times \text{UA1207}$ SRBs |
| **Stage 1 Dry / Propellant Mass ($\text{kg}$)** | $41,800\text{ kg}$ / $408,000\text{ kg}$ | $128,900\text{ kg}$ / $2,149,500\text{ kg}$ | $368,000\text{ kg}$ / $4,190,000\text{ kg}$ |
| **Stage 1 Thrust SL / Vac ($\text{kN}$)** | $7,120\text{ kN}$ / $8,010\text{ kN}$ | $34,340\text{ kN}$ / $39,260\text{ kN}$ | $96,950\text{ kN}$ / $108,400\text{ kN}$ |
| **Stage 1 $I_{sp}$ SL / Vac ($\text{s}$)** | $262\text{ s}$ / $296\text{ s}$ | $263\text{ s}$ / $304\text{ s}$ | $268\text{ s}$ / $308\text{ s}$ |
| **Stage 2 Configuration** | S-IVB-200 ($1 \times \text{J-2}$, $\text{LOX/LH}_2$) | S-II ($5 \times \text{J-2}$, $\text{LOX/LH}_2$) | S-II-S ($5 \times \text{J-2S}$, $\text{LOX/LH}_2$) |
| **Stage 2 Dry / Propellant Mass ($\text{kg}$)** | $10,400\text{ kg}$ / $104,300\text{ kg}$ | $35,840\text{ kg}$ / $451,700\text{ kg}$ | $36,500\text{ kg}$ / $465,000\text{ kg}$ |
| **Stage 2 Thrust Vac / $I_{sp}$** | $1,001\text{ kN}$ / $421\text{ s}$ | $5,115\text{ kN}$ / $421\text{ s}$ | $5,890\text{ kN}$ / $436\text{ s}$ |
| **Stage 3 Configuration** | None (2-Stage Vehicle) | S-IVB-500 ($1 \times \text{J-2}$, $\text{LOX/LH}_2$) | S-IVB-S ($1 \times \text{J-2S}$, $\text{LOX/LH}_2$) |
| **Stage 3 Dry / Propellant Mass ($\text{kg}$)** | N/A | $11,240\text{ kg}$ / $108,800\text{ kg}$ | $11,500\text{ kg}$ / $115,000\text{ kg}$ |
| **Stage 3 Thrust Vac / $I_{sp}$** | N/A | $1,023\text{ kN}$ / $426\text{ s}$ | $1,179\text{ kN}$ / $436\text{ s}$ |
| **Gross Liftoff Mass ($\text{kg}$)** | $589,700\text{ kg}$ | $2,965,241\text{ kg}$ | $5,480,000\text{ kg}$ |
| **Max Payload to $185\text{ km}$ LEO ($\text{kg}$)** | $18,600\text{ kg}$ | $140,000\text{ kg}$ | $245,000\text{ kg}$ |
| **Max Payload to TLI ($\text{kg}$)** | $0\text{ kg}$ (LEO-only) | $48,609\text{ kg}$ | $88,500\text{ kg}$ |
| **Unit Launch Cost (1969 USD)** | $\$45.0\text{M}$ | $\$185.0\text{M}$ | $\$295.0\text{M}$ |
| **Unit Launch Cost (2026 USD)** | $\$384.8\text{M}$ | $\$1,581.8\text{M}$ | $\$2,522.3\text{M}$ |

---

## Module 2: Spacecraft Bus & Modular Subsystems Catalog

### 2.1 Structure & Thermal Protection Subsystems

| Component ID | Subsystem Name | Vehicle | Dry Mass ($\text{kg}$) | Power Draw ($\text{W}$) | Cost (1969 USD) | Cost (2026 USD) | Operational Constraints & Limits |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `STR-CM-01` | CM Pressure Vessel & Inner Structure | CSM | $1,567.0\text{ kg}$ | $0\text{ W}$ | $\$14.20\text{M}$ | $\$121.41\text{M}$ | Habitable volume $6.17\text{ m}^3$; $34.5\text{ kPa}$ ($100\%\text{ O}_2$); crew max $3$. |
| `TPS-CM-01` | Avco 5026-39G Ablative Heat Shield | CSM | $848.0\text{ kg}$ | $0\text{ W}$ | $\$4.80\text{M}$ | $\$41.04\text{M}$ | Max entry $11.08\text{ km/s}$; peak $2,760^\circ\text{C}$; entry angle $-5.3^\circ$ to $-7.7^\circ$. |
| `STR-SM-01` | SM 6-Sector Honeycomb Shell & Radiators | CSM | $1,910.0\text{ kg}$ | $45\text{ W}$ | $\$9.50\text{M}$ | $\$81.23\text{M}$ | Glycol radiator loop; Sector 1 open bay on J-Series for SIM Bay. |
| `STR-LES-01` | Launch Escape System (LES) Tower | CSM | $4,173.0\text{ kg}$ | $0\text{ W}$ | $\$2.10\text{M}$ | $\$17.96\text{M}$ | $654\text{ kN}$ abort pull; jettisoned at $T+197.9\text{ s}$ ($91\text{ km}$ altitude). |
| `STR-LMD-01` | LM Descent Octagonal Frame & 4-Leg Gear | LM-D | $1,412.0\text{ kg}$ | $0\text{ W}$ | $\$11.80\text{M}$ | $\$100.89\text{M}$ | Structure $1,196\text{ kg}$ + gear $216\text{ kg}$; max slope $12^\circ$; $1.71\text{ m}$ contact probes. |
| `STR-LMA-01` | LM Ascent Cabin & Active Sublimator | LM-A | $1,395.0\text{ kg}$ | $35\text{ W}$ | $\$13.40\text{M}$ | $\$114.57\text{M}$ | Habitable volume $4.50\text{ m}^3$; $33.1\text{ kPa}$ ($100\%\text{ O}_2$); water-ice sublimator cooling. |

---

### 2.2 Electrical Power Systems (EPS)

| Component ID | Subsystem Name | Vehicle | Dry Mass ($\text{kg}$) | Reactant / Energy Capacity | Power Output / Draw ($\text{W}$) | Cost (1969 USD) | Cost (2026 USD) | Operational Constraints & Rates |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `EPS-SM-FC` | $3 \times \text{P\&W PC3A-2 H}_2/\text{O}_2$ Fuel Cells | SM | $333.0\text{ kg}$ | External Cryo Tanks | $+1,689\text{ W}$ min to $+4,260\text{ W}$ nom ($6,885\text{ W}$ peak) | $\$3.60\text{M}$ | $\$30.78\text{M}$ | Consumes $0.37\text{ kg/kWh}$ ($\approx 0.74\text{ kg/hr}$ at $2.0\text{ kW}$: $0.082\text{ kg/hr }\text{H}_2 + 0.658\text{ kg/hr }\text{O}_2$); yields $0.74\text{ kg/hr }\text{H}_2\text{O}$; non-restartable once shut down. |
| `EPS-SM-TK1` | SM Cryo Tanks — H-Series ($2\text{ O}_2, 2\text{ H}_2$) | SM | $218.0\text{ kg}$ | $325.6\text{ kg}$ ($290.3\text{ kg }\text{O}_2, 35.3\text{ kg }\text{H}_2$) / $600\text{ kWh}$ | $30\text{ W}$ (tank heaters/fans) | $\$1.90\text{M}$ | $\$16.25\text{M}$ | Max endurance $\approx 11\text{ days}$; supercritical storage at $6.2\text{ MPa}$ ($\text{O}_2$) and $1.7\text{ MPa}$ ($\text{H}_2$). |
| `EPS-SM-TK2` | SM Cryo Tanks — J-Series ($3\text{ O}_2, 3\text{ H}_2$ + Aux Bat) | SM | $356.0\text{ kg}$ | $502.0\text{ kg}$ ($446.8\text{ kg }\text{O}_2, 55.2\text{ kg }\text{H}_2$) / $915\text{ kWh}$ + $11.2\text{ kWh}$ bat | $40\text{ W}$ (heaters) | $\$2.75\text{M}$ | $\$23.51\text{M}$ | Extended $16\text{-day}$ endurance + $400\text{ Ah}$ isolated $\text{Ag-Zn}$ backup battery (post-Apollo 13 mandate). |
| `EPS-CM-BAT` | CM Entry / Post-Landing $\text{Ag-Zn}$ Batteries ($3\times$) | CM | $76.2\text{ kg}$ | $120\text{ Ah}$ ($3 \times 40\text{ Ah}$ at $28\text{ V}$) / $3.36\text{ kWh}$ | $+1,120\text{ W}$ peak discharge | $\$0.45\text{M}$ | $\$3.85\text{M}$ | Primary non-rechargeable; supports SM jettison through splashdown + $24\text{ hr}$ recovery beacon. |
| `EPS-LMD-B4` | LM Descent $\text{Ag-Zn}$ Batteries — H-Series ($4\times$) | LM-D | $244.8\text{ kg}$ | $1,660\text{ Ah}$ ($4 \times 415\text{ Ah}$ at $28\text{ V}$) / $46.48\text{ kWh}$ | $+2,400\text{ W}$ nominal bus | $\$1.10\text{M}$ | $\$9.41\text{M}$ | Supports up to $36\text{ hr}$ lunar surface stay; jettisoned at lunar liftoff. |
| `EPS-LMD-B5` | LM Descent $\text{Ag-Zn}$ Batteries — J-Series ($5\times$) | LM-D | $306.0\text{ kg}$ | $2,075\text{ Ah}$ ($5 \times 415\text{ Ah}$ at $28\text{ V}$) / $58.10\text{ kWh}$ | $+2,800\text{ W}$ nominal bus | $\$1.38\text{M}$ | $\$11.80\text{M}$ | Required for $75\text{ hr}$ J-Mission surface stay + 3 EVAs. |
| `EPS-LMA-B2` | LM Ascent $\text{Ag-Zn}$ Batteries ($2\times$) | LM-A | $113.4\text{ kg}$ | $592\text{ Ah}$ ($2 \times 296\text{ Ah}$ at $28\text{ V}$) / $16.58\text{ kWh}$ | $+1,680\text{ W}$ nominal bus | $\$0.65\text{M}$ | $\$5.56\text{M}$ | Powers lunar ascent, rendezvous, and docking ($8\text{–}10\text{ hr}$ endurance). |

---

### 2.3 Guidance, Navigation & Control (GNC / ADCS)

| Component ID | Subsystem Name | Vehicle | Dry Mass ($\text{kg}$) | Propellant Mass ($\text{kg}$) | Power Draw ($\text{W}$) | Cost (1969 USD) | Cost (2026 USD) | Technical Specifications & Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GNC-AGC-II` | Apollo Guidance Computer (AGC Block II) | CM & LM | $31.8\text{ kg}$ | N/A | $55\text{ W}$ ($15\text{ W}$ stby) | $\$1.80\text{M}$ | $\$15.39\text{M}$ | $2.048\text{ MHz}$ clock ($11.72\text{ }\mu\text{s}$ cycle); $36,864\text{ words}$ ROM ($589,824\text{ bits}$) + $2,048\text{ words}$ RAM ($32,768\text{ bits}$), $16\text{-bit}$ word ($15\text{ data} + 1\text{ parity}$). Triggers `1201`/`1202` alarm above $85\%$ CPU load. |
| `GNC-IMU-01` | Inertial Measurement Unit (3-Gimbal) | CM & LM | $19.3\text{ kg}$ | N/A | $115\text{ W}$ | $\$1.40\text{M}$ | $\$11.97\text{M}$ | 3 IRIG gyros + 3 PIPA accelerometers; drift $\approx 0.015^\circ/\text{hr}$; gimbal lock warning at $\pm 70^\circ$ pitch, lock at $\pm 85^\circ$. |
| `GNC-OPT-CM` | CM Scanning Telescope & Sextant | CM | $15.9\text{ kg}$ | N/A | $25\text{ W}$ | $\$0.75\text{M}$ | $\$6.41\text{M}$ | Star-landmark optical sightings required every $12\text{–}24\text{ hr}$ to zero IMU drift. |
| `GNC-RAD-LM` | LM Landing Radar (LR) + Rendezvous Radar (RR) | LM | $51.3\text{ kg}$ | N/A | $130\text{ W}$ (LR) / $125\text{ W}$ (RR) | $\$2.20\text{M}$ | $\$18.81\text{M}$ | LR ($19.1\text{ kg}$): 3-beam Doppler + altimeter, locks below $12.2\text{ km}$. RR ($32.2\text{ kg}$): tracks CSM transponder out to $740\text{ km}$. |
| `ACS-SM-RCS` | SM RCS Thruster Quads ($4 \times 4\text{ R-4D}$) | SM | $217.6\text{ kg}$ | $610.0\text{ kg}$ ($\text{MMH/N}_2\text{O}_4$) | $40\text{ W}$ | $\$2.40\text{M}$ | $\$20.52\text{M}$ | $16 \times 445\text{ N}$ ($100\text{ lbf}$) thrusters; $I_{sp} = 290\text{ s}$; total impulse $1,735\text{ kN}\cdot\text{s}$. |
| `ACS-CM-RCS` | CM Entry RCS ($12 \times \text{Aerojet SE-8}$) | CM | $181.0\text{ kg}$ | $112.0\text{ kg}$ ($\text{MMH/N}_2\text{O}_4$) | $20\text{ W}$ | $\$1.25\text{M}$ | $\$10.69\text{M}$ | $12 \times 410\text{ N}$ ($92\text{ lbf}$) thrusters; $I_{sp} = 290\text{ s}$; controls lift vector roll during atmospheric entry. |
| `ACS-LM-RCS` | LM RCS Thruster Quads ($4 \times 4\text{ R-4D}$) | LM-A | $184.0\text{ kg}$ | $287.0\text{ kg}$ ($\text{A-50/N}_2\text{O}_4$) | $35\text{ W}$ | $\$2.10\text{M}$ | $\$17.96\text{M}$ | $16 \times 445\text{ N}$ ($100\text{ lbf}$) thrusters; $I_{sp} = 290\text{ s}$; cross-feedable with APS propellant tanks. |

---

### 2.4 Main Propulsion Subsystems

| Component ID | Engine / System Name | Vehicle | System Dry Mass ($\text{kg}$) | Propellant Mass ($\text{kg}$) | Vacuum Thrust ($\text{kN}$) | $I_{sp}$ ($\text{s}$) | $\Delta v$ Capability ($\text{m/s}$) | Power Draw ($\text{W}$) | Cost (1969 / 2026 USD) | Operational Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `PRP-SM-SPS` | Service Propulsion System (`AJ10-137`) | SM | $1,580.0\text{ kg}$ (engine $300\text{ kg}$) | $18,413.0\text{ kg}$ ($\text{A-50/N}_2\text{O}_4$) | $91.19\text{ kN}$ ($20,500\text{ lbf}$) | $314.5\text{ s}$ | $2,804\text{ m/s}$ (solo) / $1,350\text{ m/s}$ (docked) | $85\text{ W}$ | $\$5.40\text{M}$ / $\$46.17\text{M}$ | Non-throttleable; hypergolic restartable up to $50$ burns; dual gimbal actuators. |
| `PRP-LMD-H` | LM Descent Propulsion (`TRW LMDE` — H-Series) | LM-D | $512.0\text{ kg}$ (engine $179\text{ kg}$) | $8,200.0\text{ kg}$ ($\text{A-50/N}_2\text{O}_4$) | $4.50\text{–}27.02\text{ kN}$ ($10\text{–}60\%$) & $45.04\text{ kN}$ ($100\%$) | $311.0\text{ s}$ | $2,470\text{ m/s}$ | $65\text{ W}$ | $\$4.90\text{M}$ / $\$41.89\text{M}$ | Continuous throttling $10\%\text{–}60\%$ + Fixed Throttle Position ($92.5\%\text{–}100\%$); $60\%\text{–}92.5\%$ band prohibited due to throat erosion. |
| `PRP-LMD-J` | LM Descent Propulsion (`TRW LMDE` — J-Series Ext.) | LM-D | $548.0\text{ kg}$ (engine $179\text{ kg}$) | $8,874.0\text{ kg}$ ($\text{A-50/N}_2\text{O}_4$) | $4.50\text{–}27.02\text{ kN}$ & $45.04\text{ kN}$ ($100\%$) | $311.0\text{ s}$ | $2,560\text{ m/s}$ | $65\text{ W}$ | $\$5.35\text{M}$ / $\$45.74\text{M}$ | Stretched propellant tanks ($+10.2\text{ cm}$) to carry LRV + extended ALSEP. |
| `PRP-LMA-01` | LM Ascent Propulsion (`Bell LMAE`) | LM-A | $342.0\text{ kg}$ (engine $81.6\text{ kg}$) | $2,353.0\text{ kg}$ ($\text{A-50/N}_2\text{O}_4$) | $15.57\text{ kN}$ ($3,500\text{ lbf}$) | $311.0\text{ s}$ | $2,220\text{ m/s}$ | $30\text{ W}$ | $\$3.80\text{M}$ / $\$32.49\text{M}$ | Fixed-thrust; lunar liftoff $\text{TWR} \approx 2.12$; single-engine zero-redundancy critical path. |

---

### 2.5 Communications Subsystems (Unified S-Band & Antennas)

| Component ID | Subsystem Name | Vehicle | Mass ($\text{kg}$) | Power Draw (Low / High) | Downlink / Uplink Bitrates | Cost (1969 / 2026 USD) | Operational Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `COM-CSM-USB` | CSM Unified S-Band (USB) Transponder & TWT | CSM | $14.5\text{ kg}$ | $38\text{ W}$ ($5\text{ W}$ RF) / $98\text{ W}$ ($20\text{ W}$ RF) | Uplink: $1.0\text{ kbps}$ cmd + voice; Downlink: $51.2\text{ kbps}$ (high) or $1.6\text{ kbps}$ (low) + FM TV | $\$1.60\text{M}$ / $\$13.68\text{M}$ | Carrier: $2,287.5\text{ MHz}$ down / $2,106.4\text{ MHz}$ up; coherent PRN ranging. |
| `COM-CSM-HGA` | CSM Steerable High-Gain Antenna (4-Dish Array) | SM | $15.4\text{ kg}$ | $22\text{ W}$ (servo track) | Enables full $51.2\text{ kbps}$ PCM telemetry + real-time color TV at $384,400\text{ km}$ | $\$0.95\text{M}$ / $\$8.12\text{M}$ | Gain $23.4\text{–}29.6\text{ dBi}$ ($4.5^\circ$ narrow beam); must stow during SPS burns; jettisoned with SM. |
| `COM-CSM-OMN` | CSM Omni-Directional S-Band Antennas ($4\times$) | CM | $4.4\text{ kg}$ | $0\text{ W}$ (passive) | $1.6\text{ kbps}$ low-rate telemetry + voice at lunar distance ($51.2\text{ kbps}$ via $64\text{ m}$ DSN dish) | $\$0.25\text{M}$ / $\$2.14\text{M}$ | Gain $-3\text{ to }+2\text{ dBi}$; survives SM separation for atmospheric entry & recovery. |
| `COM-LM-SB` | LM S-Band Steerable Dish ($0.66\text{ m}$) + Erectable Dish ($3.05\text{ m}$) | LM | $12.7\text{ kg}$ | $42\text{ W}$ (transceiver + servo) | $1.6\text{ kbps}$ in-flight / $51.2\text{ kbps}$ + live color TV via $3.05\text{ m}$ surface umbrella dish | $\$0.85\text{M}$ / $\$7.27\text{M}$ | Steerable dish ($6.8\text{ kg}$) used in flight; erectable umbrella ($5.9\text{ kg}$) deployed during EVA-1. |

---

## Module 3: Scientific Payload & ALSEP Instruments Catalog

### 3.1 ALSEP Power, Central Station & Surface/Orbital Payloads

The **SNAP-27 Radioisotope Thermoelectric Generator (RTG)** serves as the core electrical power plant for full ALSEP stations (Apollo 12, 14, 15, 16, 17), delivering **$+70.0\text{ W}$ to $+75.0\text{ W}$ continuous DC** across both lunar day ($+120^\circ\text{C}$) and the $340\text{-hour}$ lunar night ($-170^\circ\text{C}$), whereas Apollo 11's **EASEP** relied on solar arrays ($34\text{ W}$ daytime-only) and a Radioisotope Heater Unit (RHU).

| Payload ID | Instrument / Package Name | Missions Flown | Mass ($\text{kg}$) | Power ($\text{W}$) | Data Rate ($\text{bps}$) | Est. Cost (1969 / 2026 USD) | Science Value (Game Pts) | Scientific Purpose & Measurement Capability |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `SCI-PWR-RTG` | **SNAP-27 RTG Power System** ($\text{Pu-238}$ + Cask) | A-12, 14, 15, 16, 17 | $31.2\text{ kg}$ ($19.7\text{ kg}$ deployed) | $+72.5\text{ W}$ (output) | $0\text{ bps}$ | $\$3.20\text{M}$ / $\$27.36\text{M}$ | Infrastructure | Continuous day/night thermoelectric power ($>8\text{ yr}$ life) for ALSEP Central Station & instruments. |
| `SCI-COM-CS` | **ALSEP Central Station & Helical Antenna** | A-12, 14, 15, 16, 17 | $25.0\text{ kg}$ | $-17.5\text{ W}$ | $1,060\text{ bps}$ (cap.) | $\$4.50\text{M}$ / $\$38.48\text{M}$ | Infrastructure | Command decoder, multiplexer, and $1\text{ W}$ S-band transmitter linking ALSEP instruments to Earth MSFN. |
| `SCI-INS-PSE` | **Passive Seismic Experiment (PSE / EASEP PSEP)** | A-11 (EASEP), 12, 14, 15, 16 | $11.5\text{ kg}$ ($47.6\text{ kg}$ EASEP) | $-4.3\text{ W}$ ($-9.5\text{ W}$ night) | $450\text{ bps}$ | $\$2.80\text{M}$ / $\$23.94\text{M}$ | $250\text{ pts}$ | 3 long-period + 1 short-period seismometers detecting moonquakes & impacts to map crust/mantle/core. |
| `SCI-INS-ASE` | **Active Seismic Experiment (ASE / LSPE)** | A-14, 16 (ASE); A-17 (LSPE) | $11.2\text{ kg}$ ($26.8\text{ kg}$ LSPE) | $-3.2\text{ W}$ ($-12.0\text{ W}$ burst) | $530\text{ bps}$ | $\$2.10\text{M}$ / $\$17.96\text{M}$ | $220\text{ pts}$ | Astronaut thumper + rocket grenades/explosive charges profiling regolith & upper crust to $1\text{–}3\text{ km}$ depth. |
| `SCI-INS-LSM` | **Lunar Surface Magnetometer (LSM)** | A-12, 15, 16 | $8.9\text{ kg}$ | $-3.5\text{ W}$ | $120\text{ bps}$ | $\$1.90\text{M}$ / $\$16.25\text{M}$ | $180\text{ pts}$ | 3-axis fluxgate magnetometer measuring crustal remanent magnetism & deep interior electrical conductivity. |
| `SCI-INS-SWS` | **Solar Wind Spectrometer (SWS)** | A-12, 15 | $5.7\text{ kg}$ | $-5.5\text{ W}$ | $160\text{ bps}$ | $\$1.50\text{M}$ / $\$12.83\text{M}$ | $160\text{ pts}$ | 7 Faraday cups quantifying solar wind electron/proton flux & energy spectra ($10\text{ eV}\text{–}10\text{ keV}$). |
| `SCI-INS-HFE` | **Heat Flow Experiment (HFE + Surface Drill)** | A-15, 16, 17 | $18.0\text{ kg}$ ($4.6\text{ kg}$ HFE + $13.4\text{ kg}$ drill) | $-3.1\text{ W}$ ($-8.5\text{ W}$ pulse) | $60\text{ bps}$ | $\$2.40\text{M}$ / $\$20.52\text{M}$ | $240\text{ pts}$ | Dual $2.5\text{ m}$ borehole thermal probes measuring internal lunar heat flux ($14\text{–}21\text{ mW/m}^2$) & radiogenic heat. |
| `SCI-INS-CCG` | **Cold Cathode Gauge Experiment (CCGE / CCIG)** | A-12, 14, 15 | $2.7\text{ kg}$ | $-2.0\text{ W}$ | $30\text{ bps}$ | $\$1.10\text{M}$ / $\$9.41\text{M}$ | $140\text{ pts}$ | Magnetron ionization gauge measuring ultra-high vacuum lunar exosphere pressure ($10^{-12}\text{ torr}$). |
| `SCI-INS-LRR` | **Laser Ranging Retroreflector (LRRR)** | A-11, 14 (100 cubes); A-15 (300 cubes) | $23.6\text{ kg}$ ($36.2\text{ kg}$ A-15) | $0.0\text{ W}$ (passive) | $0\text{ bps}$ (optical) | $\$1.40\text{M}$ / $\$11.97\text{M}$ | $210\text{ pts}$ | Fused-silica corner-cube array enabling sub-cm Earth-Moon laser ranging ($3.8\text{ cm/yr}$ recession) & relativity tests. |
| `SCI-MOB-LRV` | **Lunar Roving Vehicle (LRV)** | A-15, 16, 17 | $210.0\text{ kg}$ dry ($490\text{ kg}$ payload) | Internal $8.71\text{ kWh}$ $\text{Ag-Zn}$ ($350\text{ W}$ avg) | $51,200\text{ bps}$ + TV (via LCRU) | $\$9.50\text{M}$ / $\$81.23\text{M}$ | $450\text{ pts}$ | 4-wheel electric rover extending EVA traverse radius to $>9.5\text{ km}$ ($35.9\text{ km}$ odometer on Apollo 17). |
| `SCI-ORB-SIM` | **SIM Bay Orbital Science Suite** (SM Sector 1) | A-15, 16, 17 | $482.0\text{ kg}$ | $-285.0\text{ W}$ ($-420\text{ W}$ peak) | $4,800\text{ bps}$ + $1,980\text{ m}$ film | $\$18.50\text{M}$ / $\$158.18\text{M}$ | $550\text{ pts}$ | Pan/Metric cameras, Laser Altimeter, Gamma/X-Ray/Alpha/Mass Spectrometers, and Apollo 17 Lunar Sounder. |

---

## Module 4: Orbital Options & Trajectory Trade-Offs (Scenes 5 & 6)

### 4.1 Translunar Trajectory Profile Comparison

| Trajectory Profile | Historical Missions | Total Translunar $\Delta v$ (TLI + MCC) | LOI + TEI $\Delta v$ Cost | Transit Time (TLI to LOI) | Safety / Abort Margin | Landing Site Latitude Envelope |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Circumlunar Free-Return** | Apollo 8, 10, 11 | $3,051.0 + 6.4 = 3,057.4\text{ m/s}$ | $937.0 + 999.0 = 1,936.0\text{ m/s}$ | $75\text{ hr } 50\text{ min}$ ($75.83\text{ hr}$) | **Maximum (Passive):** Zero-burn ballistic slingshot around Moon ($110\text{ km}$ pericynthion) into Earth entry corridor ($\approx 145\text{ hr}$ total). | Narrow equatorial band: $\pm 5.0^\circ$ latitude (e.g., Mare Tranquillitatis $0.67^\circ\text{ N}$). |
| **2. Hybrid Non-Free-Return** | Apollo 12, 13, 14 | $3,045.0 + 21.5 = 3,066.5\text{ m/s}$ | $882.0 + 925.0 = 1,807.0\text{ m/s}$ | $81\text{ hr } 55\text{ min}$ to $83\text{ hr } 25\text{ min}$ | **High (Active LM DPS):** Leaves free-return at $\text{GET} + 30\text{ hr}$ (MCC-2); LM DPS ($2,470\text{ m/s}$ reserve) can execute $260\text{ m/s}$ PC+2 abort (Apollo 13 profile). | Low-to-mid latitudes: $\pm 15.0^\circ$ latitude (e.g., Fra Mauro $3.65^\circ\text{ S}$); optimal $5^\circ\text{–}14^\circ$ sun elevation. |
| **3. Direct High-Inclination J-Mission** | Apollo 15, 16, 17 | $3,048.4 + 4.2 = 3,052.6\text{ m/s}$ | $908.0 + 928.0 = 1,836.0\text{ m/s}$ (+ $65\text{ m/s}$ SPS DOI) | $78\text{ hr } 31\text{ min}$ to $86\text{ hr } 14\text{ min}$ | **Moderate (Time-Critical DPS):** Non-free-return directly from TLI; requires $250\text{–}350\text{ m/s}$ DPS abort burn within $24\text{ hr}$ of TLI. | High-latitude & highlands: $\pm 30.0^\circ$ latitude (e.g., Hadley-Apennine $26.13^\circ\text{ N}$, Taurus-Littrow $20.19^\circ\text{ N}$). |

---

### 4.2 Lunar Orbit Insertion (LOI) & Orbital Environment Parameters

| Orbital Parameter | Value (SI Units) | Operational Impact in `crates/sim-core` |
| :--- | :--- | :--- |
| **Initial LOI-1 Capture Orbit** | $111.1\text{ km} \times 314.8\text{ km}$ ($60 \times 170\text{ nmi}$) | Elliptical capture orbit; $\Delta v \approx 889\text{ m/s}$ (Apollo 11) to $914\text{ m/s}$ (Apollo 15). |
| **Circularized Parking Orbit (LOI-2)** | $111.1\text{ km} \times 111.1\text{ km}$ ($60 \times 60\text{ nmi}$) | Nominal CSM solo science & rendezvous orbit; orbital velocity $v_{\text{orb}} = 1,633\text{ m/s}$. |
| **Descent Orbit Insertion (DOI)** | $15.2\text{ km} \times 111.1\text{ km}$ ($50,000\text{ ft} \times 60\text{ nmi}$) | $\Delta v = 21.8\text{ m/s}$; executed by LM DPS on A-11/12, or CSM SPS on A-14/15/16/17 to save LM descent fuel. |
| **Lunar Orbital Period ($111.1\text{ km}$)** | $118.7\text{ minutes}$ ($7,122\text{ s}$) | Governs EVA communication pass windows and rendezvous phasing opportunities. |
| **Lunar Shadow / Eclipse Duration** | $46.0\text{ to }48.5\text{ minutes/orbit}$ | $\sim 39\%$ of each orbit in complete darkness; increases CSM/LM heater power draw by $+85\text{ W}$. |
| **Far-Side Comms Blackout (LOS)** | $45.5\text{ to }47.5\text{ minutes/orbit}$ | Complete Loss of Signal (LOS) behind lunar limb; all burns (LOI-1, DOI, TEI) execute autonomously via AGC. |

---

### 4.3 Powered Descent & Landing Envelope (Scene 6)

| Powered Descent Phase / Milestone | Altitude AGL ($\text{m}$) | Horizontal Velocity ($V_x$) | Vertical Velocity ($V_z$) | DPS Throttle & Burn Rate ($\text{kg/s}$) | Guidance & Maneuver Dynamics |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Powered Descent Initiation (PDI)** | $15,240\text{ m}$ ($50,000\text{ ft}$) | $1,695.0\text{ m/s}$ | $0.0\text{ m/s}$ | $10\%$ ullage ($26\text{ s}$) $\rightarrow 92.5\%\text{–}100\%$ FTP ($41.7\text{–}45.0\text{ kN}$, $14.2\text{ kg/s}$) | Braking phase ($\sim 510\text{ s}$); Landing Radar locks on at $\le 12,200\text{ m}$ ($40,000\text{ ft}$) to update AGC altitude ($\Delta H$). |
| **High Gate (Approach Initiation)** | $2,130\text{–}2,440\text{ m}$ ($7,400\text{ ft}$ on A-11) | $152.4\text{ m/s}$ ($500\text{ ft/s}$) | $-38.1\text{ m/s}$ ($-125\text{ ft/s}$) | Throttles down to $\approx 55\%$ ($24.8\text{ kN}$, $8.1\text{ kg/s}$) | **Pitchover Maneuver:** LM pitches upright from $\sim 65^\circ$ to $\sim 35^\circ$, bringing target crater into Landing Point Designator (LPD) view. |
| **Low Gate (Final Landing Phase)** | $152.4\text{ m}$ ($500\text{ ft}$) | $18.3\text{ m/s}$ ($60\text{ ft/s}$) | $-4.6\text{ to }-5.8\text{ m/s}$ | Throttles to lunar hover $\approx 26\%\text{–}30\%$ ($11.7\text{–}13.5\text{ kN}$, $4.1\text{–}4.6\text{ kg/s}$) | Near-vertical attitude ($<10^\circ$ tilt); commander transitions to `P66` manual rate-of-descent hover/redesignation. |
| **Low-Level Propellant Warning** | $\approx 30\text{–}60\text{ m}$ | $\le 5.0\text{ m/s}$ | $-1.0\text{ to }-2.0\text{ m/s}$ | $\approx 27\%$ ($12.2\text{ kN}$, $4.2\text{ kg/s}$) | Quantity light illuminates at $5\%$ remaining ($\approx 255\text{ kg}$ usable propellant $\approx 60\text{ s}$ to Bingo, $94\text{ s}$ to dry tanks). |
| **"Bingo Fuel" Mandatory Abort Limit** | $<15\text{ m}$ | $\le 1.5\text{ m/s}$ | $-0.5\text{ to }-1.0\text{ m/s}$ | $\approx 26\%$ ($11.7\text{ kN}$, $4.1\text{ kg/s}$) | **Apollo 11 Margin:** Landed with **$25\text{ s}$** usable hover fuel remaining ($\sim 112\text{ kg}$, $17\text{–}20\text{ s}$ before mandatory abort-stage call). |
| **Touchdown Structural Limits** | $0.0\text{ m}$ (Contact) | **$\le 1.22\text{ m/s}$** ($4.0\text{ ft/s}$) | **$\le 3.05\text{ m/s}$** ($V_x=0$) or **$\le 2.13\text{ m/s}$** ($V_x=1.22\text{ m/s}$) | Engine cutoff (`PRO` button) at $1.71\text{ m}$ probe contact | Max surface slope/tilt **$\le 12.0^\circ$**; max angular body rates **$\le 2.0^\circ/\text{s}$**; exceeding limits triggers leg collapse or tip-over. |

---

## Module 5: Programmatic Budget & Time Allocation

### 5.1 Historical Cost Breakdown & Normalized Game Currency

Based on NASA's 1973 Congressional Accounting Report, NASA SP-4029, and The Planetary Society's *Space Policy* historical audit (`FY 1960–1973`), total Project Apollo direct expenditures were **$\$25,400\text{M}$ (1969/then-year USD)**, equivalent to **$\$217,170\text{M}$ (2026 USD)** using a $8.55\times$ CPI conversion.

| Program Cost Category | Cumulative R&D + Hardware (1969 USD) | Cumulative Cost (2026 USD) | Program Share ($\%$) | Marginal Single-Mission Cost (1969 USD) | Normalized Game Budget ($\text{Credits}$, Base $10,000$) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Saturn V & Launch Vehicles** (Stages, F-1/J-2, IU) | $\$9,374.0\text{M}$ | $\$80,147.7\text{M}$ | $36.9\%$ | $\$185.0\text{M}$ | $4,680\text{ CR}$ |
| **Command & Service Module (CSM)** (Block I & II) | $\$3,742.0\text{M}$ | $\$31,994.1\text{M}$ | $14.7\%$ | $\$55.0\text{M}$ | $1,390\text{ CR}$ |
| **Lunar Module (LM)** (R&D + 15 Flight Articles) | $\$2,298.0\text{M}$ | $\$19,647.9\text{M}$ | $9.0\%$ | $\$41.0\text{M}$ | $1,040\text{ CR}$ |
| **Scientific Payloads** (ALSEP, LRV, SIM Bay, LRL) | $\$594.0\text{M}$ | $\$5,078.7\text{M}$ | $2.3\%$ | $\$25.0\text{M}\text{–}\$42.0\text{M}$ | $630\text{–}1,060\text{ CR}$ |
| **Mission Operations, MSFN & Facilities** | $\$9,392.0\text{M}$ | $\$80,301.6\text{M}$ | $37.0\%$ | $\$70.0\text{M}$ | $1,770\text{ CR}$ |
| **Total Project / Mission Baseline** | **$\$25,400.0\text{M}$** | **$\$217,170.0\text{M}$** | **$100.0\%$** | **$\$376.0\text{M}\text{–}\$393.0\text{M}$** | **$10,000\text{ CR}$** |

---

### 5.2 Nominal Mission Phase Timeline Durations (`HH:MM`)

| Mission Phase | Apollo 11 (`G-Mission`) | Apollo 12 (`H-Mission`) | Apollo 15 (`J-Mission`) | Apollo 17 (`J-Mission`) |
| :--- | :--- | :--- | :--- | :--- |
| **1. Launch to TLI Cutoff** | `02:50` | `02:53` | `02:56` | `03:18` |
| **2. Trans-Lunar Coast (TLI to LOI-1)** | `73:00` | `80:32` | `75:35` | `82:56` |
| **3. Lunar Orbit & Surface Stay (LOI-1 to TEI)** | `59:30` | `88:58` | `145:13` | `147:48` |
| *— Sub-Phase: Lunar Surface Stay (Touchdown to Liftoff)* | *`21:36` (1 EVA: `02:31`)* | *`31:31` (2 EVAs: `07:45`)* | *`66:55` (3 EVAs: `18:35`)* | *`74:59` (3 EVAs: `22:04`)* |
| **4. Trans-Earth Coast (TEI to Splashdown)** | `59:58` | `72:13` | `71:27` | `77:46` |
| **Total Mission Duration (GET)** | **`195:18`** ($8.14\text{ days}$) | **`244:36`** ($10.19\text{ days}$) | **`295:11`** ($12.30\text{ days}$) | **`301:51`** ($12.58\text{ days}$) |

---

## Module 6: Historical Anomalies & Causal Failure Modes

The following 8 historical anomalies are structured as deterministic or probabilistic state-machine triggers for `crates/sim-core`'s Causal Failure Tracer.

| Anomaly ID | Mission & GET | Trigger Condition | Resource & Telemetry Impact | Causal Failure Chain & Resolution |
| :--- | :--- | :--- | :--- | :--- |
| `ANOM-A11-01` | **Apollo 11** (`GET 102:38:22`) | Rendezvous Radar switch left in `SLEW` mode during Powered Descent (`P63`/`P64`) while Landing Radar is active. | AGC CPU duty cycle spikes by $+13\%$ ($>98\%$ total load); triggers `1201`/`1202` Executive Overflow alarms ($5\times$ in $4\text{ min}$). | **Chain:** Phase-reference mismatch $\rightarrow$ $6,400\text{ Hz}$ spurious counter interrupts $\rightarrow$ AGC core queue saturation $\rightarrow$ automated priority-scheduled software restart (`BAILOUT`). **Resolution:** Ground (`GUIDO`) issues `GO` based on priority executive clearing non-essential display tasks. |
| `ANOM-A11-02` | **Apollo 11** (`GET 102:44:00`) | Unmodeled lunar gravitational mascon anomalies + residual cabin venting velocity ($+1.8\text{ m/s}$) at undocking. | Downrange landing target shifts $+6.4\text{ km}$ into boulder-strewn West Crater; requires $60\text{ s}$ extra horizontal hover ($-260\text{ kg}$ DPS fuel). | **Chain:** Mascon orbital perturbation + $\Delta H$ radar offset $\rightarrow$ guidance targets hazardous crater $\rightarrow$ Commander engages `P66` manual attitude/ROD control $\rightarrow$ drains propellant to $25\text{ s}$ before Bingo limit. **Resolution:** Manual redesignation to smooth mare plain; immediate engine cutoff on probe contact. |
| `ANOM-A12-01` | **Apollo 12** (`T+36.5 s` & `T+52.0 s`) | Launch through electrified cumulus rain clouds at $1,950\text{ m}$ and $4,390\text{ m}$ altitude; Saturn V exhaust plume acts as lightning channel. | All 3 SM Fuel Cells disconnect from main DC bus; 9 non-essential telemetry sensors fail; CSM drops to $75\text{ A}$ entry battery load ($-1.4\text{ kW}$ bus drop). | **Chain:** Cloud-to-vehicle lightning strike $\rightarrow$ Silicon Controlled Rectifier (SCR) overload trips fuel cell disconnect relays $\rightarrow$ Signal Conditioning Electronics (SCE) drops offline. **Resolution:** EECOM John Aaron calls *"Flight, try SCE to Aux"*; crew resets fuel cells on main bus in orbit. |
| `ANOM-A13-01` | **Apollo 13** (`GET 55:54:53`) | Damaged Teflon wire insulation inside SM Cryogenic $\text{O}_2$ Tank 2 (from pre-flight $65\text{ V}$ heater thermostatic switch weld) + routine cryo fan stir command. | Tank 2 pressure spikes to $6.95\text{ MPa}$ and ruptures; Tank 1 leaks to $0\text{ kg}$ within $130\text{ min}$; SM Fuel Cells $1$ & $3$ die immediately, Fuel Cell $2$ dies at `58:00` ($-4,260\text{ W}$ total SM power loss). | **Chain:** Arcing stirrer fan ignites Teflon insulation $\rightarrow$ dome blowout blows off SM Sector 4 panel $\rightarrow$ damages Tank 1 valve $\rightarrow$ complete loss of SM $\text{O}_2$, $\text{H}_2$, potable water, and SPS propulsion. **Resolution:** Crew powers down CM completely ($0\text{ W}$) and migrates to LM *Aquarius* as lifeboat. |
| `ANOM-A13-02` | **Apollo 13** (`GET 58:40:00` – `141:30:00`) | Extended 3-crew occupancy of 2-crew LM lifeboat during $83\text{-hour}$ circumlunar return. | LM electrical load must be throttled from $55\text{ A}$ ($1,540\text{ W}$) down to **$12\text{ A}$ ($336\text{ W}$)**; potable water rationed to $0.17\text{ L/day/crew}$; $\text{CO}_2$ partial pressure rises to $1.99\text{ kPa}$ ($14.9\text{ mmHg}$). | **Chain:** Power-down turns off AGC, IMU, and cabin heaters (cabin drops to $3.3^\circ\text{C}$) $\rightarrow$ square CM $\text{LiOH}$ canisters incompatible with round LM scrubbers $\rightarrow$ $\text{CO}_2$ toxicity risk. **Resolution:** Fabricate "Mailbox" adapter using flight plan covers/tape; transfer $12\text{ Ah}$ back from LM batteries to recharge CM entry batteries. |
| `ANOM-A14-01` | **Apollo 14** (`GET 03:13:00` – `04:56:56`) | Foreign contaminant or ice/lubricant interference inside CSM docking probe capture latches during Transposition, Docking, and Extraction (TD&E). | 5 consecutive docking attempts fail; consumes $+48\text{ kg}$ SM RCS propellant and delays TLI+3 MCC by $1\text{ hr } 45\text{ min}$. | **Chain:** Capture latches fail to cock on soft-dock contact $\rightarrow$ mission rules prohibit lunar landing without hard-dock ring lock $\rightarrow$ risk of immediate mission abort to Earth orbit. **Resolution:** Crew retracts probe, fires $+X$ RCS thrusters continuously to force ring contact, and fires capture-retract pyros to engage all 12 automatic ring latches. |
| `ANOM-A14-02` | **Apollo 14** (`GET 104:00:00` – `108:15:00`) | Loose metallic solder ball floating inside LM `ABORT` pushbutton switch housing closes contact intermittently in zero-$g$. | LGC receives spurious `ABORT` discrete signal; if triggered after PDI, LGC would automatically stage Descent Stage and fire APS abort to orbit. | **Chain:** Vibration/zero-$g$ drift shorts `ABORT` switch pins $\rightarrow$ hardware discrete bypasses software inhibit in `P63`/`P64` $\rightarrow$ guaranteed loss of lunar landing if not patched before PDI. **Resolution:** MIT Draper Lab (`Don Eyles`) writes real-time erasable RAM patch (`VERB 25 NOUN 07`) masking the `ABORT` bit via `V77` flag until after PDI. |
| `ANOM-A15-01` | **Apollo 15** (`GET 295:10:42`) | Venting of unburned CM RCS monomethylhydrazine ($\text{MMH}$) fuel during descent ignites in hot wake, severing suspension risers of Main Ringsail Parachute #1 at $1,800\text{ m}$ altitude. | Terminal splashdown velocity increases from nominal $8.5\text{ m/s}$ ($28\text{ ft/s}$) on 3 chutes to **$9.7\text{ m/s}$ ($31.8\text{ ft/s}$)** on 2 chutes ($+30\%$ kinetic energy impact). | **Chain:** High-altitude RCS fuel dump burns nylon riser lines $\rightarrow$ 1 of 3 main parachutes collapses completely $\rightarrow$ hard ocean splashdown ($15\text{ }g$ peak deceleration). **Resolution:** Redundant 2-chute Apollo recovery design absorbs impact safely without structural breach or crew injury *(Note: J-Mission pools also include Apollo 16 SPS secondary yaw gimbal servo oscillation and Apollo 16 HFE Kapton ribbon cable trip break).* |

---

## Module 7: Ready-to-Use Simulation Engine JSON Template (`shared-schema` & `sim-core`)

The JSON object below is formatted with strict SI numeric types, snake_case field identifiers, and normalized bounds for direct deserialization in Rust (`serde::Deserialize`) and TypeScript (`zod` / interface schemas).

```json
{
  "schema_version": "1.0.0",
  "units_standard": {
    "mass": "kg",
    "thrust": "kN",
    "isp": "s",
    "velocity": "m/s",
    "altitude": "km",
    "pressure": "kPa",
    "power": "W",
    "energy": "kWh",
    "bitrate": "bps",
    "currency_historical": "USD_1969",
    "currency_adjusted": "USD_2026",
    "cpi_multiplier": 8.55
  },
  "launch_vehicles": [
    {
      "id": "lv_saturn_ib",
      "name": "Saturn IB (AS-200)",
      "tier": 1,
      "glom_kg": 589700,
      "max_leo_payload_kg": 18600,
      "max_tli_payload_kg": 0,
      "unit_cost_1969_usd": 45000000,
      "unit_cost_2026_usd": 384750000,
      "stages": [
        {
          "stage_index": 1,
          "id": "s_ib",
          "dry_mass_kg": 41800,
          "propellant_mass_kg": 408000,
          "thrust_sl_kn": 7120,
          "thrust_vac_kn": 8010,
          "isp_sl_s": 262.0,
          "isp_vac_s": 296.0,
          "burn_duration_s": 144.0
        },
        {
          "stage_index": 2,
          "id": "s_ivb_200",
          "dry_mass_kg": 10400,
          "propellant_mass_kg": 104300,
          "thrust_sl_kn": 486,
          "thrust_vac_kn": 1001,
          "isp_sl_s": 200.0,
          "isp_vac_s": 421.0,
          "burn_duration_s": 470.0
        }
      ]
    },
    {
      "id": "lv_saturn_v_j",
      "name": "Saturn V (J-Series AS-510/512)",
      "tier": 2,
      "glom_kg": 2965241,
      "liftoff_twr_range": [1.174, 1.181],
      "max_q_kpa_range": [34.3, 35.8],
      "max_q_altitude_km": 13.6,
      "max_leo_payload_kg": 140000,
      "max_tli_payload_kg": 48609,
      "unit_cost_1969_usd": 185000000,
      "unit_cost_2026_usd": 1581750000,
      "stages": [
        {
          "stage_index": 1,
          "id": "s_ic",
          "dry_mass_kg": 128900,
          "propellant_mass_kg": 2149500,
          "thrust_sl_kn": 34340,
          "thrust_vac_kn": 39260,
          "isp_sl_s": 263.0,
          "isp_vac_s": 304.0,
          "burn_duration_s": 161.1,
          "separation_altitude_km": 67.6,
          "separation_velocity_ms": 2756.0
        },
        {
          "stage_index": 2,
          "id": "s_ii",
          "dry_mass_kg": 35840,
          "interstage_mass_kg": 3650,
          "propellant_mass_kg": 451700,
          "thrust_sl_kn": 4400,
          "thrust_vac_kn": 5115,
          "isp_sl_s": 200.0,
          "isp_vac_s": 421.0,
          "burn_duration_s": 388.2,
          "separation_altitude_km": 186.1,
          "separation_velocity_ms": 6945.0
        },
        {
          "stage_index": 3,
          "id": "s_ivb_500",
          "dry_mass_kg": 11240,
          "iu_plus_sla_mass_kg": 3836,
          "propellant_mass_kg": 108800,
          "thrust_sl_kn": 486,
          "thrust_vac_kn": 1023,
          "isp_sl_s": 200.0,
          "isp_vac_s": 426.0,
          "epo_burn_duration_s": 147.3,
          "tli_burn_duration_s": 351.0,
          "tli_delta_v_ms": 3048.4
        }
      ]
    },
    {
      "id": "lv_saturn_v_25s",
      "name": "Uprated Saturn V-25(S) / MLV-V-4(S)",
      "tier": 3,
      "glom_kg": 5480000,
      "max_leo_payload_kg": 245000,
      "max_tli_payload_kg": 88500,
      "unit_cost_1969_usd": 295000000,
      "unit_cost_2026_usd": 2522250000,
      "stages": [
        {
          "stage_index": 1,
          "id": "s_ic_plus_4x_ua1207",
          "dry_mass_kg": 368000,
          "propellant_mass_kg": 4190000,
          "thrust_sl_kn": 96950,
          "thrust_vac_kn": 108400,
          "isp_sl_s": 268.0,
          "isp_vac_s": 308.0,
          "burn_duration_s": 158.0
        },
        {
          "stage_index": 2,
          "id": "s_ii_s",
          "dry_mass_kg": 36500,
          "propellant_mass_kg": 465000,
          "thrust_sl_kn": 4950,
          "thrust_vac_kn": 5890,
          "isp_sl_s": 210.0,
          "isp_vac_s": 436.0,
          "burn_duration_s": 372.0
        },
        {
          "stage_index": 3,
          "id": "s_ivb_s",
          "dry_mass_kg": 11500,
          "propellant_mass_kg": 115000,
          "thrust_sl_kn": 540,
          "thrust_vac_kn": 1179,
          "isp_sl_s": 210.0,
          "isp_vac_s": 436.0,
          "burn_duration_s": 465.0
        }
      ]
    }
  ],
  "spacecraft_subsystems": [
    {
      "id": "STR-CM-01",
      "category": "structure",
      "vehicle": "CSM",
      "dry_mass_kg": 1567.0,
      "power_w": 0.0,
      "cost_1969_usd": 14200000,
      "constraints": { "habitable_volume_m3": 6.17, "cabin_pressure_kpa": 34.5, "max_crew": 3 }
    },
    {
      "id": "TPS-CM-01",
      "category": "thermal_protection",
      "vehicle": "CSM",
      "dry_mass_kg": 848.0,
      "power_w": 0.0,
      "cost_1969_usd": 4800000,
      "constraints": { "max_entry_velocity_ms": 11080.0, "entry_angle_deg_range": [-7.7, -5.3] }
    },
    {
      "id": "STR-SM-01",
      "category": "structure",
      "vehicle": "CSM",
      "dry_mass_kg": 1910.0,
      "power_w": -45.0,
      "cost_1969_usd": 9500000,
      "constraints": { "sim_bay_supported": true }
    },
    {
      "id": "STR-LMD-01",
      "category": "structure",
      "vehicle": "LM_DESCENT",
      "dry_mass_kg": 1412.0,
      "power_w": 0.0,
      "cost_1969_usd": 11800000,
      "constraints": { "max_landing_slope_deg": 12.0, "probe_length_m": 1.71 }
    },
    {
      "id": "STR-LMA-01",
      "category": "structure",
      "vehicle": "LM_ASCENT",
      "dry_mass_kg": 1395.0,
      "power_w": -35.0,
      "cost_1969_usd": 13400000,
      "constraints": { "habitable_volume_m3": 4.5, "cabin_pressure_kpa": 33.1, "max_crew": 2 }
    },
    {
      "id": "EPS-SM-FC",
      "category": "power",
      "vehicle": "CSM",
      "dry_mass_kg": 333.0,
      "power_w": 4260.0,
      "peak_power_w": 6885.0,
      "reactant_burn_kg_per_kwh": 0.37,
      "cost_1969_usd": 3600000,
      "constraints": { "module_count": 3, "restartable_in_flight": false }
    },
    {
      "id": "EPS-SM-TK2",
      "category": "power_storage",
      "vehicle": "CSM",
      "dry_mass_kg": 356.0,
      "reactant_mass_kg": 502.0,
      "energy_kwh": 926.2,
      "power_w": -40.0,
      "cost_1969_usd": 2750000,
      "constraints": { "series": "J_SERIES", "aux_battery_ah": 400 }
    },
    {
      "id": "EPS-CM-BAT",
      "category": "power_storage",
      "vehicle": "CSM",
      "dry_mass_kg": 76.2,
      "capacity_ah": 120.0,
      "energy_kwh": 3.36,
      "power_w": 1120.0,
      "cost_1969_usd": 450000,
      "constraints": { "rechargeable": false, "entry_and_recovery_only": true }
    },
    {
      "id": "EPS-LMD-B5",
      "category": "power_storage",
      "vehicle": "LM_DESCENT",
      "dry_mass_kg": 306.0,
      "capacity_ah": 2075.0,
      "energy_kwh": 58.1,
      "power_w": 2800.0,
      "cost_1969_usd": 1380000,
      "constraints": { "max_surface_stay_hr": 75.0 }
    },
    {
      "id": "EPS-LMA-B2",
      "category": "power_storage",
      "vehicle": "LM_ASCENT",
      "dry_mass_kg": 113.4,
      "capacity_ah": 592.0,
      "energy_kwh": 16.58,
      "power_w": 1680.0,
      "cost_1969_usd": 650000,
      "constraints": { "max_ascent_endurance_hr": 10.0 }
    },
    {
      "id": "GNC-AGC-II",
      "category": "gnc",
      "vehicle": "BOTH",
      "dry_mass_kg": 31.8,
      "power_w": -55.0,
      "clock_mhz": 2.048,
      "rom_words": 36864,
      "ram_words": 2048,
      "word_bits": 16,
      "cost_1969_usd": 1800000,
      "constraints": { "cpu_overflow_threshold": 0.85 }
    },
    {
      "id": "GNC-IMU-01",
      "category": "gnc",
      "vehicle": "BOTH",
      "dry_mass_kg": 19.3,
      "power_w": -115.0,
      "cost_1969_usd": 1400000,
      "constraints": { "drift_deg_per_hr": 0.015, "gimbal_lock_deg": 85.0 }
    },
    {
      "id": "PRP-SM-SPS",
      "category": "propulsion",
      "vehicle": "CSM",
      "dry_mass_kg": 1580.0,
      "propellant_mass_kg": 18413.0,
      "thrust_kn": 91.19,
      "isp_s": 314.5,
      "delta_v_solo_ms": 2804.0,
      "power_w": -85.0,
      "cost_1969_usd": 5400000,
      "constraints": { "throttleable": false, "max_restarts": 50 }
    },
    {
      "id": "PRP-LMD-J",
      "category": "propulsion",
      "vehicle": "LM_DESCENT",
      "dry_mass_kg": 548.0,
      "propellant_mass_kg": 8874.0,
      "thrust_kn": 45.04,
      "throttle_range_pct": [10.0, 60.0],
      "fixed_throttle_pct": 92.5,
      "isp_s": 311.0,
      "delta_v_ms": 2560.0,
      "power_w": -65.0,
      "cost_1969_usd": 5350000,
      "constraints": { "prohibited_throttle_band_pct": [60.1, 92.4] }
    },
    {
      "id": "PRP-LMA-01",
      "category": "propulsion",
      "vehicle": "LM_ASCENT",
      "dry_mass_kg": 342.0,
      "propellant_mass_kg": 2353.0,
      "thrust_kn": 15.57,
      "isp_s": 311.0,
      "delta_v_ms": 2220.0,
      "power_w": -30.0,
      "cost_1969_usd": 3800000,
      "constraints": { "throttleable": false, "lunar_liftoff_twr": 2.12 }
    },
    {
      "id": "COM-CSM-USB",
      "category": "communications",
      "vehicle": "CSM",
      "dry_mass_kg": 14.5,
      "power_low_w": -38.0,
      "power_high_w": -98.0,
      "downlink_low_bps": 1600,
      "downlink_high_bps": 51200,
      "uplink_bps": 1000,
      "cost_1969_usd": 1600000
    },
    {
      "id": "COM-CSM-HGA",
      "category": "communications",
      "vehicle": "CSM",
      "dry_mass_kg": 15.4,
      "power_w": -22.0,
      "downlink_high_bps": 51200,
      "cost_1969_usd": 950000,
      "constraints": { "gain_dbi_range": [23.4, 29.6], "stow_during_sps": true }
    }
  ],
  "science_payloads": [
    {
      "id": "SCI-PWR-RTG",
      "name": "SNAP-27 RTG Power System",
      "mass_kg": 31.2,
      "power_w": 72.5,
      "data_rate_bps": 0,
      "cost_1969_usd": 3200000,
      "science_value": 0,
      "day_night_capable": true
    },
    {
      "id": "SCI-COM-CS",
      "name": "ALSEP Central Station",
      "mass_kg": 25.0,
      "power_w": -17.5,
      "data_rate_bps": 1060,
      "cost_1969_usd": 4500000,
      "science_value": 0
    },
    {
      "id": "SCI-INS-PSE",
      "name": "Passive Seismic Experiment (PSE)",
      "mass_kg": 11.5,
      "power_w": -4.3,
      "data_rate_bps": 450,
      "cost_1969_usd": 2800000,
      "science_value": 250
    },
    {
      "id": "SCI-INS-ASE",
      "name": "Active Seismic Experiment (ASE/LSPE)",
      "mass_kg": 11.2,
      "power_w": -3.2,
      "data_rate_bps": 530,
      "cost_1969_usd": 2100000,
      "science_value": 220
    },
    {
      "id": "SCI-INS-LSM",
      "name": "Lunar Surface Magnetometer (LSM)",
      "mass_kg": 8.9,
      "power_w": -3.5,
      "data_rate_bps": 120,
      "cost_1969_usd": 1900000,
      "science_value": 180
    },
    {
      "id": "SCI-INS-SWS",
      "name": "Solar Wind Spectrometer (SWS)",
      "mass_kg": 5.7,
      "power_w": -5.5,
      "data_rate_bps": 160,
      "cost_1969_usd": 1500000,
      "science_value": 160
    },
    {
      "id": "SCI-INS-HFE",
      "name": "Heat Flow Experiment (HFE + Drill)",
      "mass_kg": 18.0,
      "power_w": -3.1,
      "data_rate_bps": 60,
      "cost_1969_usd": 2400000,
      "science_value": 240
    },
    {
      "id": "SCI-INS-CCG",
      "name": "Cold Cathode Gauge Experiment (CCGE)",
      "mass_kg": 2.7,
      "power_w": -2.0,
      "data_rate_bps": 30,
      "cost_1969_usd": 1100000,
      "science_value": 140
    },
    {
      "id": "SCI-INS-LRR",
      "name": "Laser Ranging Retroreflector (LRRR)",
      "mass_kg": 36.2,
      "power_w": 0.0,
      "data_rate_bps": 0,
      "cost_1969_usd": 1400000,
      "science_value": 210
    },
    {
      "id": "SCI-MOB-LRV",
      "name": "Lunar Roving Vehicle (LRV)",
      "mass_kg": 210.0,
      "power_w": 0.0,
      "internal_battery_kwh": 8.71,
      "data_rate_bps": 51200,
      "cost_1969_usd": 9500000,
      "science_value": 450,
      "traverse_radius_km": 9.5
    },
    {
      "id": "SCI-ORB-SIM",
      "name": "SIM Bay Orbital Science Suite",
      "mass_kg": 482.0,
      "power_w": -285.0,
      "data_rate_bps": 4800,
      "cost_1969_usd": 18500000,
      "science_value": 550
    }
  ],
  "trajectories_and_landing": {
    "profiles": [
      {
        "id": "traj_free_return",
        "name": "Circumlunar Free-Return",
        "tli_plus_mcc_dv_ms": 3057.4,
        "loi_plus_tei_dv_ms": 1936.0,
        "transit_hours": 75.83,
        "passive_abort_return": true,
        "max_latitude_deg": 5.0
      },
      {
        "id": "traj_hybrid",
        "name": "Hybrid Non-Free-Return",
        "tli_plus_mcc_dv_ms": 3066.5,
        "loi_plus_tei_dv_ms": 1807.0,
        "transit_hours": 82.5,
        "passive_abort_return": false,
        "dps_abort_dv_ms": 260.0,
        "max_latitude_deg": 15.0
      },
      {
        "id": "traj_direct_high_inc",
        "name": "Direct High-Inclination J-Mission",
        "tli_plus_mcc_dv_ms": 3052.6,
        "loi_plus_tei_dv_ms": 1901.0,
        "transit_hours": 82.0,
        "passive_abort_return": false,
        "dps_abort_dv_ms": 310.0,
        "max_latitude_deg": 30.0
      }
    ],
    "lunar_orbit": {
      "parking_altitude_km": 111.1,
      "doi_pericynthion_km": 15.2,
      "orbital_period_min": 118.7,
      "eclipse_duration_min_range": [46.0, 48.5],
      "farside_blackout_min_range": [45.5, 47.5]
    },
    "powered_descent": {
      "pdi_altitude_m": 15240.0,
      "pdi_horizontal_vel_ms": 1695.0,
      "high_gate_altitude_m": 2255.0,
      "high_gate_vertical_vel_ms": -38.1,
      "low_gate_altitude_m": 152.4,
      "low_gate_vertical_vel_ms": -5.2,
      "hover_burn_rate_kgs": 4.3,
      "bingo_fuel_reserve_s": 25.0,
      "touchdown_limits": {
        "max_vertical_vel_ms": 3.05,
        "max_combined_vertical_vel_ms": 2.13,
        "max_horizontal_vel_ms": 1.22,
        "max_tilt_deg": 12.0,
        "max_angular_rate_degs": 2.0
      }
    }
  },
  "anomalies": [
    {
      "id": "ANOM-A11-01",
      "mission": "Apollo 11",
      "get_seconds": 369502,
      "trigger_condition": "rr_switch_slew AND landing_radar_active",
      "impact": { "agc_cpu_load_delta": 0.13, "alarm_code": 1202 },
      "corrective_action": "ground_go_priority_bailout"
    },
    {
      "id": "ANOM-A11-02",
      "mission": "Apollo 11",
      "get_seconds": 369840,
      "trigger_condition": "mascon_perturbation AND downrange_crater_hazard",
      "impact": { "dps_propellant_kg": -260.0, "hover_margin_s": 25.0 },
      "corrective_action": "manual_p66_redesignation"
    },
    {
      "id": "ANOM-A12-01",
      "mission": "Apollo 12",
      "get_seconds": 36.5,
      "trigger_condition": "launch_through_convective_cloud",
      "impact": { "sm_fuel_cells_online": 0, "bus_power_w": -1400.0 },
      "corrective_action": "switch_sce_to_aux_and_reset_fuel_cells"
    },
    {
      "id": "ANOM-A13-01",
      "mission": "Apollo 13",
      "get_seconds": 201293,
      "trigger_condition": "cryo_o2_tank2_stir_fan_short",
      "impact": { "sm_o2_kg": -290.3, "sm_fuel_cells_online": 0, "sps_available": false },
      "corrective_action": "power_down_cm_and_activate_lm_lifeboat"
    },
    {
      "id": "ANOM-A13-02",
      "mission": "Apollo 13",
      "get_seconds": 211200,
      "trigger_condition": "lm_lifeboat_duration_hr > 24",
      "impact": { "lm_bus_power_limit_w": 336.0, "co2_partial_pressure_kpa": 1.99 },
      "corrective_action": "build_cm_to_lm_lioh_scrubber_adapter"
    },
    {
      "id": "ANOM-A14-01",
      "mission": "Apollo 14",
      "get_seconds": 11580,
      "trigger_condition": "docking_probe_capture_latch_jam",
      "impact": { "sm_rcs_propellant_kg": -48.0, "timeline_delay_s": 6300 },
      "corrective_action": "sustained_rcs_thrust_and_pyro_retract_hard_dock"
    },
    {
      "id": "ANOM-A14-02",
      "mission": "Apollo 14",
      "get_seconds": 374400,
      "trigger_condition": "lm_abort_switch_solder_ball_short",
      "impact": { "uncommanded_descent_abort_risk": 1.0 },
      "corrective_action": "agc_ram_patch_v25n07_mask_abort_bit"
    },
    {
      "id": "ANOM-A15-01",
      "mission": "Apollo 15",
      "get_seconds": 1062642,
      "trigger_condition": "cm_rcs_fuel_dump_ignites_chute_riser",
      "impact": { "active_main_chutes": 2, "splashdown_velocity_ms": 9.7 },
      "corrective_action": "redundant_two_chute_nominal_splashdown"
    }
  ]
}
```