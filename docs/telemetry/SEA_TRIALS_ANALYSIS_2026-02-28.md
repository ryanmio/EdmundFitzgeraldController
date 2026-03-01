# Sea Trials Telemetry Analysis — Edmund Fitzgerald
**Date:** February 28, 2026  
**Source data:** `Telemetry - EdmundFitzgerald - Sea Trials - Sheet1.csv`  
**Rows logged:** 117 samples across a ~7 min 52 sec window  
**Note on data gaps:** Gaps in the log correspond to periods when the operator closed the telemetry app to record video. The device remained running and connected throughout.

---

## 1. Session Timeline

| Event | Wall Clock (UTC) | ESP Uptime |
|---|---|---|
| Device boot (estimated) | ~20:35:40 | 0 s |
| Logging begins | 20:38:07 | 146 s |
| Last dry reading (pre-intrusion) | 20:39:23 | 221 s |
| *(app closed — video recording)* | 20:39:23 – 20:41:22 | 221 – 340 s |
| **First water intrusion detected** | ≤ 20:41:22 | ≤ 340 s |
| Water clears (1st time) | 20:42:49 | 427 s |
| **Water returns (2nd event)** | 20:43:26 | 464 s |
| Water clears (2nd time) | 20:45:41 | 600 s |
| Last logged reading | 20:45:59 | 618 s |

**Total device runtime captured:** ~10.3 minutes (uptime 0–618 s), of which ~7 min 52 sec was actively logged.

---

## 2. Water Intrusion

### Pattern
The water sensor (`water_intrusion`) fired twice during the trial in an alternating wet/dry pattern, consistent with a slow seep or drip rather than flooding — water reaches the sensor, then drains or dries between events.

| Phase | Uptime | Status | Duration |
|---|---|---|---|
| Boot → gap | 0 – 221 s | Dry | ≥ 3.7 min |
| *(video gap — unknown)* | 221 – 340 s | Unknown | ~2 min |
| Event 1 | 340 – 399 s | **WET** | ~59 sec |
| Dry interval | 427 – 442 s | Dry | ~15 sec |
| Event 2 | 464 – 514 s | **WET** | ~50 sec |
| Final dry | 600 – 618 s | Dry | ~18 sec (end of log) |

### Key Finding
Water first entered the hull **within approximately 5 minutes 40 seconds of device boot**, and likely within the 2-minute video gap (3.7–5.7 min post-boot). The leaks are slow and intermittent — the sensor does not stay continuously triggered — which means water is finding a small path in but the hull is not rapidly taking on water.

**Sensor note:** `water_sensor_raw` is the logical inverse of `water_intrusion` (1 = dry, 0 = wet). This is the expected behavior of a pull-up conductivity sensor and confirms the sensor is wired correctly.

### Recommendation
Inspect hull seams and any cable/shaft penetrations. Apply additional marine sealant to any suspect entry points. Consider a post-run inspection to identify where water accumulates inside the hull.

---

## 3. Battery Analysis

**Battery:** Tenergy 8.4V NiMH Flat Pack, 1600mAh, 7-cell (7 × 1.2V)

### NiMH Voltage Reference
| Condition | Per Cell | 7-Cell Pack |
|---|---|---|
| Fully charged | ~1.40–1.45V | ~9.8–10.15V |
| Nominal | 1.20V | 8.4V |
| Safe discharge cutoff | ~1.00–1.05V | ~7.0–7.35V |

### Observed Voltages (averaged by phase)

| Phase | Uptime | Avg Voltage | Min | Max |
|---|---|---|---|---|
| Early — dry | 146–221 s | **~8.71V** | 8.35V | 8.97V |
| Mid — wet (event 1) | 340–399 s | **~7.73V** | 7.36V | 7.94V |
| Mid — dry interval | 427–442 s | **~7.97V** | 7.80V | 8.07V |
| Late — wet (event 2) | 464–514 s | **~7.97V** | 7.65V | 8.26V |
| Late — dry | 600–618 s | **~7.91V** | 7.72V | 8.18V |

### Interpretation

The battery started the trial at **~8.71V average** — below a fully charged 7-cell NiMH pack (~9.8–10V). This indicates the pack was **not freshly fully charged** before launch, or some charge had already been consumed in pre-trial testing.

By the end of the log (~10 minutes in), the pack was averaging **~7.9V**, still comfortably above the 7.0–7.35V cutoff but trending downward. The lowest single reading was **7.36V** (at first water intrusion detection), which is right at the edge of safe discharge territory — though the noisy ADC makes this reading suspect (see below).

NiMH packs have a notably **flat discharge curve** through mid-range, so the apparent ~0.8V drop over 10 minutes is meaningful and indicates the pack had already consumed a significant portion of its charge before the trial.

**Estimated remaining runtime at end of log:** Without knowing the exact load, a rough estimate based on NiMH discharge behavior at this voltage level suggests the pack had roughly **15–30 minutes** of remaining runtime at the observed draw — but this is highly load-dependent (motors draw far more than idle ESP32).

### ADC Noise Concern
Battery voltage readings swing **±0.3–0.5V between consecutive 1-second samples** — far too volatile for the actual battery to explain. This is ADC noise. For example:

```
8.86V → 8.47V → 8.88V → 8.76V → 8.35V → 8.88V
```

This noise will make low-battery threshold alerts unreliable and creates false urgency. **Recommend averaging 8–10 ADC samples before reporting voltage** to smooth readings to within ~±0.05V.

### Recommendation
1. Always charge the battery fully before a trial — the starting voltage suggests it was not.
2. Implement ADC averaging in firmware for stable voltage readings.
3. Set a low-battery alert at ~7.5V (averaged), giving margin above the 7.0–7.35V hard cutoff.
4. Log battery at more voyages to build a discharge curve and determine true runtime.

---

## 4. WiFi Signal Strength

Signal strength ranged from **-20 dBm** (excellent — boat was very close to the access point) to **-75 dBm** (marginal — near the edge of reliable range).

| Signal Range | Quality | Observed During |
|---|---|---|
| -20 to -35 dBm | Excellent | 20:42:51–52 and select close-range moments |
| -35 to -55 dBm | Good | Most of the dry/mid-range periods |
| -55 to -65 dBm | Fair | During water intrusion events (boat further out) |
| -65 to -75 dBm | Marginal | Outer range passes; early wet readings |

### Observations
- The strongest signals (-20 to -21 dBm) were recorded at 20:42:51–52, likely when the boat was retrieved or brought back toward the operator.
- The weakest signals (-70 to -75 dBm) coincided with the first water intrusion window, suggesting the boat was at the **far end of its operating range** when water entered.
- Signal never dropped completely (all readings show `connection_status: online`), indicating WiFi range was sufficient for this trial environment.

### Recommendation
If the boat operates on open water at greater distances, test WiFi reliability past ~-75 dBm conditions. Consider the physical range limit a factor in whether the boat should be retrieved before signal degrades further.

---

## 5. System Health

| Metric | Status |
|---|---|
| `connection_status` | `online` for all 117 rows — no disconnections |
| `dfplayer_available` | `1` (available) for all rows — audio system healthy |
| `running_led` | `0` throughout — LED was off during this trial |
| `ip_address` | Stable at `172.20.10.6` for entire session |

The electronics performed reliably throughout. No reboots or disconnections occurred (the ESP uptime counter incremented continuously with no resets).

---

## 6. Summary of Findings

| Finding | Severity | Action |
|---|---|---|
| Water intrusion within ~6 min of launch | **High** | Locate and seal hull entry points |
| Battery was not fully charged at launch | Medium | Charge fully before future trials |
| ADC voltage noise ±0.3–0.5V | Medium | Add firmware ADC averaging (8–10 samples) |
| Lowest voltage reading 7.36V (near cutoff) | Medium | Monitor; set firmware alert at 7.5V |
| WiFi marginal at outer range (-75 dBm) | Low | Note range limit for future operations |
| No reboots, no disconnections | — | Nominal |
