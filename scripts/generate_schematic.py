import uuid

# Track instances to fix the "?" issue in KiCAD
instances = []

def gen_uuid():
    return str(uuid.uuid4())

def add_instance(ref, unit, value, footprint, symb_uuid):
    instances.append({
        "ref": ref,
        "unit": unit,
        "value": value,
        "footprint": footprint,
        "uuid": symb_uuid
    })

def kicad_label(text, x, y, rot=0):
    return f'  (label "{text}" (at {x} {y} {rot}) (effects (font (size 1.27 1.27)) (justify left bottom)) (uuid "{gen_uuid()}"))'

def kicad_wire(x1, y1, x2, y2):
    return f'  (wire (pts (xy {x1} {y1}) (xy {x2} {y2})) (stroke (width 0) (type solid)) (uuid "{gen_uuid()}"))'

def kicad_orthogonal_wire(x1, y1, x2, y2, mid_x):
    """Draws an L-shaped orthogonal wire from (x1,y1) to (x2,y2) via mid_x"""
    return [
        kicad_wire(x1, y1, mid_x, y1),
        kicad_wire(mid_x, y1, mid_x, y2),
        kicad_wire(mid_x, y2, x2, y2)
    ]

def kicad_text(text, x, y, size=1.5):
    return f'  (text "{text}" (at {x} {y} 0) (effects (font (size {size} {size}))) (uuid "{gen_uuid()}"))'

# --- SYMBOL DEFINITIONS ---
symbols = """
  (symbol "Device:R" (pin_numbers hide) (pin_names (offset 0)) (in_bom yes) (on_board yes)
   (property "Reference" "R" (at 2.032 0 90)) (property "Value" "R" (at 0 0 90))
   (symbol "R_0_1" (rectangle (start -1.016 -2.54) (end 1.016 2.54) (stroke (width 0.254)) (fill (type none))))
   (symbol "R_1_1"
    (pin passive line (at 0 3.81 270) (length 1.27) (name "~" (effects (font (size 1.27 1.27)))) (number "1"))
    (pin passive line (at 0 -3.81 90) (length 1.27) (name "~" (effects (font (size 1.27 1.27)))) (number "2")))
  )
  (symbol "Transistor_FET:Q_NMOS_GDS" (pin_names (offset 0) hide) (in_bom yes) (on_board yes)
   (property "Reference" "Q" (at 5.08 2.54 0)) (property "Value" "Q_NMOS_GDS" (at 5.08 0 0))
   (symbol "Q_NMOS_GDS_0_1"
    (polyline (pts (xy 0.254 0) (xy 2.54 0)) (stroke (width 0)))
    (polyline (pts (xy 2.54 1.905) (xy 2.54 -1.905)) (stroke (width 0.254)))
    (polyline (pts (xy 3.81 2.54) (xy 3.81 1.27)) (stroke (width 0)))
    (polyline (pts (xy 3.81 -2.54) (xy 3.81 -1.27)) (stroke (width 0)))
    (circle (center 3.175 0) (radius 3.81) (stroke (width 0.254)) (fill (type none)))
    (pin input line (at 0 0 0) (length 2.54) (name "G" (effects (font (size 1.27 1.27)))) (number "1"))
    (pin passive line (at 3.81 5.08 270) (length 2.54) (name "D" (effects (font (size 1.27 1.27)))) (number "2"))
    (pin passive line (at 3.81 -5.08 90) (length 2.54) (name "S" (effects (font (size 1.27 1.27)))) (number "3")))
  )
  (symbol "Device:LED" (pin_numbers hide) (pin_names (offset 1.016) hide) (in_bom yes) (on_board yes)
   (property "Reference" "D" (at 0 2.54 0)) (property "Value" "LED" (at 0 -2.54 0))
   (symbol "LED_0_1"
    (polyline (pts (xy -1.27 -1.27) (xy -1.27 1.27) (xy 1.27 0) (xy -1.27 -1.27)) (stroke (width 0.254)) (fill (type none)))
    (polyline (pts (xy 1.27 -1.27) (xy 1.27 1.27)) (stroke (width 0.254))))
   (symbol "LED_1_1"
    (pin passive line (at -3.81 0 0) (length 2.54) (name "K" (effects (font (size 1.27 1.27)))) (number "1"))
    (pin passive line (at 3.81 0 180) (length 2.54) (name "A" (effects (font (size 1.27 1.27)))) (number "2")))
  )
  (symbol "MCU_Espressif:ESP32-WROOM-32" (pin_names (offset 1.016)) (in_bom yes) (on_board yes)
   (property "Reference" "U" (at -12.7 20.32 0)) (property "Value" "ESP32-WROOM-32" (at 0 20.32 0))
   (symbol "ESP32-WROOM-32_0_1"
    (rectangle (start -12.7 -17.78) (end 12.7 17.78) (stroke (width 0.254)) (fill (type background))))
   (symbol "ESP32-WROOM-32_1_1"
    (pin power_in line (at -15.24 15.24 0) (length 2.54) (name "3V3" (effects (font (size 1.27 1.27)))) (number "1"))
    (pin bidirectional line (at -15.24 5.08 0) (length 2.54) (name "IO34" (effects (font (size 1.27 1.27)))) (number "5"))
    (pin bidirectional line (at -15.24 0 0) (length 2.54) (name "IO32" (effects (font (size 1.27 1.27)))) (number "7"))
    (pin bidirectional line (at -15.24 -5.08 0) (length 2.54) (name "IO25" (effects (font (size 1.27 1.27)))) (number "9"))
    (pin bidirectional line (at -15.24 -7.62 0) (length 2.54) (name "IO26" (effects (font (size 1.27 1.27)))) (number "10"))
    (pin bidirectional line (at -15.24 -10.16 0) (length 2.54) (name "IO27" (effects (font (size 1.27 1.27)))) (number "11"))
    (pin power_in line (at 0 -20.32 90) (length 2.54) (name "GND" (effects (font (size 1.27 1.27)))) (number "15"))
    (pin bidirectional line (at 15.24 -15.24 180) (length 2.54) (name "IO23" (effects (font (size 1.27 1.27)))) (number "37"))
    (pin bidirectional line (at 15.24 -12.7 180) (length 2.54) (name "IO22" (effects (font (size 1.27 1.27)))) (number "36"))
    (pin bidirectional line (at 15.24 -10.16 180) (length 2.54) (name "IO21" (effects (font (size 1.27 1.27)))) (number "33"))
    (pin bidirectional line (at 15.24 -7.62 180) (length 2.54) (name "IO19" (effects (font (size 1.27 1.27)))) (number "31"))
    (pin bidirectional line (at 15.24 -5.08 180) (length 2.54) (name "IO18" (effects (font (size 1.27 1.27)))) (number "30"))
    (pin bidirectional line (at 15.24 -2.54 180) (length 2.54) (name "IO4" (effects (font (size 1.27 1.27)))) (number "26"))
    (pin bidirectional line (at 15.24 0 180) (length 2.54) (name "IO2" (effects (font (size 1.27 1.27)))) (number "24"))
    (pin bidirectional line (at 15.24 2.54 180) (length 2.54) (name "IO16" (effects (font (size 1.27 1.27)))) (number "25")))
  )
  (symbol "Module:MAX98357A" (in_bom yes) (on_board yes)
   (property "Reference" "U" (at 0 15.24 0)) (property "Value" "MAX98357A" (at 0 12.7 0))
   (symbol "MAX98357A_0_1" (rectangle (start -10.16 -12.7) (end 10.16 12.7) (stroke (width 0.254)) (fill (type background))))
   (symbol "MAX98357A_1_1"
    (pin power_in line (at -12.7 10.16 0) (length 2.54) (name "Vin" (effects (font (size 1.27 1.27)))) (number "1"))
    (pin power_in line (at -12.7 7.62 0) (length 2.54) (name "GND" (effects (font (size 1.27 1.27)))) (number "2"))
    (pin input line (at -12.7 5.08 0) (length 2.54) (name "BCLK" (effects (font (size 1.27 1.27)))) (number "3"))
    (pin input line (at -12.7 2.54 0) (length 2.54) (name "LRC" (effects (font (size 1.27 1.27)))) (number "4"))
    (pin input line (at -12.7 0 0) (length 2.54) (name "DIN" (effects (font (size 1.27 1.27)))) (number "5"))
    (pin output line (at 12.7 0 180) (length 2.54) (name "SPK+" (effects (font (size 1.27 1.27)))) (number "6"))
    (pin output line (at 12.7 -2.54 180) (length 2.54) (name "SPK-" (effects (font (size 1.27 1.27)))) (number "7")))
  )
  (symbol "Module:DFPlayer_Pro" (in_bom yes) (on_board yes)
   (property "Reference" "U" (at 0 17.78 0)) (property "Value" "DFPlayer_Pro" (at 0 15.24 0))
   (symbol "DFPlayer_Pro_0_1" (rectangle (start -10.16 -15.24) (end 10.16 15.24) (stroke (width 0.254)) (fill (type background))))
   (symbol "DFPlayer_Pro_1_1"
    (pin power_in line (at -12.7 12.7 0) (length 2.54) (name "VCC" (effects (font (size 1.27 1.27)))) (number "1"))
    (pin power_in line (at -12.7 10.16 0) (length 2.54) (name "GND" (effects (font (size 1.27 1.27)))) (number "2"))
    (pin input line (at -12.7 7.62 0) (length 2.54) (name "RX" (effects (font (size 1.27 1.27)))) (number "3"))
    (pin output line (at -12.7 5.08 0) (length 2.54) (name "TX" (effects (font (size 1.27 1.27)))) (number "4"))
    (pin output line (at 12.7 12.7 180) (length 2.54) (name "L-OUT" (effects (font (size 1.27 1.27)))) (number "5"))
    (pin output line (at 12.7 10.16 180) (length 2.54) (name "R-OUT" (effects (font (size 1.27 1.27)))) (number "6")))
  )
  (symbol "Module:ESP32-CAM" (in_bom yes) (on_board yes)
   (property "Reference" "U" (at 0 15.24 0)) (property "Value" "ESP32-CAM" (at 0 12.7 0))
   (symbol "ESP32-CAM_0_1" (rectangle (start -10.16 -12.7) (end 10.16 12.7) (stroke (width 0.254)) (fill (type background))))
   (symbol "ESP32-CAM_1_1"
    (pin power_in line (at -12.7 10.16 0) (length 2.54) (name "5V" (effects (font (size 1.27 1.27)))) (number "1"))
    (pin power_in line (at -12.7 7.62 0) (length 2.54) (name "GND" (effects (font (size 1.27 1.27)))) (number "2"))
    (pin input line (at -12.7 5.08 0) (length 2.54) (name "U0R" (effects (font (size 1.27 1.27)))) (number "3"))
    (pin output line (at -12.7 2.54 0) (length 2.54) (name "U0T" (effects (font (size 1.27 1.27)))) (number "4"))))
  (symbol "Connector:Conn_01x03_Male" (pin_names (offset 1.016) hide) (in_bom yes) (on_board yes)
   (property "Reference" "J" (at 0 5.08 0)) (property "Value" "RC_Pin" (at 0 -2.54 0))
   (symbol "Conn_01x03_Male_0_1" (rectangle (start -1.27 -1.27) (end 1.27 6.35) (stroke (width 0.254)) (fill (type none))))
   (symbol "Conn_01x03_Male_1_1"
    (pin passive line (at -5.08 5.08 0) (length 3.81) (name "1" (effects (font (size 1.27 1.27)))) (number "1"))
    (pin passive line (at -5.08 2.54 0) (length 3.81) (name "2" (effects (font (size 1.27 1.27)))) (number "2"))
    (pin passive line (at -5.08 0 0) (length 3.81) (name "3" (effects (font (size 1.27 1.27)))) (number "3"))))
  (symbol "Motor:Servo" (pin_names (offset 1.016) hide) (in_bom yes) (on_board yes)
   (property "Reference" "M" (at 0 5.08 0)) (property "Value" "Rudder_Servo" (at 0 -2.54 0))
   (symbol "Servo_0_1" (rectangle (start -2.54 -2.54) (end 2.54 5.08) (stroke (width 0.254)) (fill (type none))))
   (symbol "Servo_1_1"
    (pin input line (at -5.08 2.54 0) (length 2.54) (name "PWM" (effects (font (size 1.27 1.27)))) (number "1"))
    (pin power_in line (at -5.08 0 0) (length 2.54) (name "VCC" (effects (font (size 1.27 1.27)))) (number "2"))
    (pin power_in line (at -5.08 -2.54 0) (length 2.54) (name "GND" (effects (font (size 1.27 1.27)))) (number "3"))))
"""

content = [
    '(kicad_sch (version 20230121) (generator eeschema)',
    f' (uuid "{gen_uuid()}")',
    ' (paper "A3")',
    ' (title_block (title "Edmund Fitzgerald - FULL SYSTEM") (company "Project Edmund Fitzgerald") (rev "2.3") (date "2026-01-31"))',
    ' (lib_symbols', symbols, ' )',
    '',
]

# --- INSTANCES ---
u1_uuid = gen_uuid(); add_instance("U1", 1, "ESP32_Control", "", u1_uuid)
content.append(f' (symbol (lib_id "MCU_Espressif:ESP32-WROOM-32") (at 150 100 0) (unit 1) (uuid "{u1_uuid}") (in_bom yes) (on_board yes) (fields_autoplaced yes) (property "Reference" "U1" (at 150 75 0)) (property "Value" "ESP32_Control" (at 150 125 0)))')

# --- RUNNING LIGHTS (Q1) ---
q1_uuid = gen_uuid(); add_instance("Q1", 1, "MOSFET_N", "", q1_uuid)
r1_uuid = gen_uuid(); add_instance("R1", 1, "100", "", r1_uuid)
r2_uuid = gen_uuid(); add_instance("R2", 1, "10k", "", r2_uuid)
d1_uuid = gen_uuid(); add_instance("D1", 1, "Running_Light", "", d1_uuid)
content.extend([
    f' (symbol (lib_id "Transistor_FET:Q_NMOS_GDS") (at 210 97.46 0) (unit 1) (uuid "{q1_uuid}") (in_bom yes) (on_board yes) (property "Reference" "Q1" (at 218 92 0)) (property "Value" "MOSFET_N" (at 218 97 0)))',
    f' (symbol (lib_id "Device:R") (at 190 97.46 90) (unit 1) (uuid "{r1_uuid}") (in_bom yes) (on_board yes) (property "Reference" "R1" (at 190 92 0)) (property "Value" "100" (at 190 103 0)))',
    f' (symbol (lib_id "Device:R") (at 210 110 0) (unit 1) (uuid "{r2_uuid}") (in_bom yes) (on_board yes) (property "Reference" "R2" (at 215 110 0)) (property "Value" "10k" (at 215 115 0)))',
    f' (symbol (lib_id "Device:LED") (at 213.81 80 90) (unit 1) (uuid "{d1_uuid}") (in_bom yes) (on_board yes) (property "Reference" "D1" (at 213.81 75 0)) (property "Value" "Running_Light" (at 213.81 85 0)))',
    kicad_wire(165.24, 97.46, 186.19, 97.46), kicad_wire(193.81, 97.46, 210, 97.46),
    kicad_wire(210, 97.46, 210, 106.19), kicad_wire(210, 113.81, 210, 120),
    kicad_wire(213.81, 92.38, 213.81, 83.81), kicad_wire(213.81, 76.19, 213.81, 70),
    kicad_wire(213.81, 102.54, 213.81, 120),
    kicad_label("8.4V_BATT", 213.81, 70, 90), kicad_label("GND", 210, 120, 90), kicad_label("GND", 213.81, 120, 90),
])

# --- FLOOD LIGHTS (Q2) ---
q2_uuid = gen_uuid(); add_instance("Q2", 1, "MOSFET_N", "", q2_uuid)
r5_uuid = gen_uuid(); add_instance("R5", 1, "100", "", r5_uuid)
r6_uuid = gen_uuid(); add_instance("R6", 1, "10k", "", r6_uuid)
d2_uuid = gen_uuid(); add_instance("D2", 1, "Flood_Light", "", d2_uuid)
content.extend([
    f' (symbol (lib_id "Transistor_FET:Q_NMOS_GDS") (at 210 147.46 0) (unit 1) (uuid "{q2_uuid}") (in_bom yes) (on_board yes) (property "Reference" "Q2" (at 218 142 0)) (property "Value" "MOSFET_N" (at 218 147 0)))',
    f' (symbol (lib_id "Device:R") (at 190 147.46 90) (unit 1) (uuid "{r5_uuid}") (in_bom yes) (on_board yes) (property "Reference" "R5" (at 190 142 0)) (property "Value" "100" (at 190 153 0)))',
    f' (symbol (lib_id "Device:R") (at 210 160 0) (unit 1) (uuid "{r6_uuid}") (in_bom yes) (on_board yes) (property "Reference" "R6" (at 215 160 0)) (property "Value" "10k" (at 215 165 0)))',
    f' (symbol (lib_id "Device:LED") (at 213.81 130 90) (unit 1) (uuid "{d2_uuid}") (in_bom yes) (on_board yes) (property "Reference" "D2" (at 213.81 125 0)) (property "Value" "Flood_Light" (at 213.81 135 0)))',
    kicad_wire(165.24, 110.16, 186.19, 147.46), kicad_wire(193.81, 147.46, 210, 147.46),
    kicad_wire(210, 147.46, 210, 156.19), kicad_wire(210, 163.81, 210, 170),
    kicad_wire(213.81, 142.38, 213.81, 133.81), kicad_wire(213.81, 126.19, 213.81, 120),
    kicad_wire(213.81, 152.54, 213.81, 170),
    kicad_label("8.4V_BATT", 213.81, 120, 90), kicad_label("GND", 210, 170, 90), kicad_label("GND", 213.81, 170, 90),
])

# --- BATTERY SENSOR ---
r3_uuid = gen_uuid(); add_instance("R3", 1, "100k", "", r3_uuid)
r4_uuid = gen_uuid(); add_instance("R4", 1, "47k", "", r4_uuid)
content.extend([
    f' (symbol (lib_id "Device:R") (at 100 94.92 90) (unit 1) (uuid "{r3_uuid}") (in_bom yes) (on_board yes) (property "Reference" "R3" (at 100 89 0)) (property "Value" "100k" (at 100 100 0)))',
    f' (symbol (lib_id "Device:R") (at 110 110 0) (unit 1) (uuid "{r4_uuid}") (in_bom yes) (on_board yes) (property "Reference" "R4" (at 115 110 0)) (property "Value" "47k" (at 115 115 0)))',
    kicad_wire(134.76, 94.92, 103.81, 94.92), kicad_wire(96.19, 94.92, 85, 94.92),
    kicad_wire(103.81, 94.92, 110, 94.92), kicad_wire(110, 94.92, 110, 106.19),
    kicad_wire(110, 113.81, 110, 120),
    kicad_label("8.4V_BATT", 85, 94.92), kicad_label("GND", 110, 120, 90),
])

# --- WATER SENSOR ---
content.extend([
    kicad_wire(134.76, 100, 110, 100), kicad_label("WATER_SENSOR", 110, 100),
])

# --- AUDIO MODULES ---
u2_uuid = gen_uuid(); add_instance("U2", 1, "MAX98357A", "", u2_uuid)
content.append(f' (symbol (lib_id "Module:MAX98357A") (at 260 140 0) (unit 1) (uuid "{u2_uuid}") (in_bom yes) (on_board yes) (property "Reference" "U2" (at 260 125 0)) (property "Value" "MAX98357A" (at 260 155 0)))')
u3_uuid = gen_uuid(); add_instance("U3", 1, "DFPlayer_Pro", "", u3_uuid)
content.append(f' (symbol (lib_id "Module:DFPlayer_Pro") (at 260 200 0) (unit 1) (uuid "{u3_uuid}") (in_bom yes) (on_board yes) (property "Reference" "U3" (at 260 180 0)) (property "Value" "DFPlayer_Pro" (at 260 220 0)))')

# --- PHYSICAL WIRING (ORTHOGONAL) ---
# I2S BCLK: ESP Pin 9 (105.08) to Amp Pin 3 (134.92)
content.extend(kicad_orthogonal_wire(134.76, 105.08, 247.3, 134.92, 140))
# I2S LRC: ESP Pin 36 (112.7) to Amp Pin 4 (137.46)
content.extend(kicad_orthogonal_wire(165.24, 112.7, 247.3, 137.46, 240))
# I2S DIN: ESP Pin 37 (115.24) to Amp Pin 5 (140.00)
content.extend(kicad_orthogonal_wire(165.24, 115.24, 247.3, 140.00, 242))

# DFP RX: ESP Pin 10 (IO26 TX) to DFP RX Pin 3 (192.38)
content.extend(kicad_orthogonal_wire(134.76, 107.62, 247.3, 192.38, 142))
# DFP TX: ESP Pin 11 (IO27 RX) to DFP TX Pin 4 (194.92)
content.extend(kicad_orthogonal_wire(134.76, 110.16, 247.3, 194.92, 144))

# Power/GND for modules (short taps)
content.extend([
    kicad_wire(247.3, 129.84, 240, 129.84), kicad_label("5V_POWER", 240, 129.84),
    kicad_wire(247.3, 132.38, 240, 132.38), kicad_label("GND", 240, 132.38),
    kicad_wire(247.3, 187.3, 240, 187.3), kicad_label("5V_POWER", 240, 187.3),
    kicad_wire(247.3, 189.84, 240, 189.84), kicad_label("GND", 240, 189.84),
])

# --- RC RECEIVER ---
# (Removing the old label-only section to replace with physical wiring)

# --- RC INTERFACE (RECEIVER & SERVOS) ---
# J1: Receiver Connector (Source of PWM)
j1_uuid = gen_uuid(); add_instance("J1", 1, "RC_Receiver", "", j1_uuid)
content.append(f' (symbol (lib_id "Connector:Conn_01x03_Male") (at 80 150 0) (unit 1) (uuid "{j1_uuid}") (in_bom yes) (on_board yes) (property "Reference" "J1" (at 80 142 0)) (property "Value" "RC_Receiver" (at 80 158 0)))')

# M1: Rudder Servo (Target of PWM)
m1_uuid = gen_uuid(); add_instance("M1", 1, "Rudder_Servo", "", m1_uuid)
content.append(f' (symbol (lib_id "Motor:Servo") (at 80 180 0) (unit 1) (uuid "{m1_uuid}") (in_bom yes) (on_board yes) (property "Reference" "M1" (at 80 172 0)) (property "Value" "Rudder_Servo" (at 80 188 0)))')

# PHYSICAL WIRING FOR RC PATH
# Pin 1 of J1 (Throttle) to ESP IO18 (Pin 30: 165.24, 105.08)
content.extend(kicad_orthogonal_wire(74.92, 144.92, 165.24, 105.08, 90))
# Pin 2 of J1 (Servo) to ESP IO19 (Pin 31: 165.24, 107.62) AND M1 Pin 1
content.extend(kicad_orthogonal_wire(74.92, 147.46, 165.24, 107.62, 92))
content.extend(kicad_orthogonal_wire(74.92, 147.46, 74.92, 177.46, 70)) # Tap from J1 to M1 Servo

# Power for RC/Servo
content.extend([
    kicad_wire(74.92, 150, 65, 150), kicad_label("5V_POWER", 65, 150, 180),
    kicad_wire(74.92, 152.54, 65, 152.54), kicad_label("GND", 65, 152.54, 180),
    kicad_wire(74.92, 180, 65, 180), kicad_label("5V_POWER", 65, 180, 180),
    kicad_wire(74.92, 182.54, 65, 182.54), kicad_label("GND", 65, 182.54, 180),
])

# --- CAMERA MODULE ---
u4_uuid = gen_uuid(); add_instance("U4", 1, "ESP32-CAM", "", u4_uuid)
content.append(f' (symbol (lib_id "Module:ESP32-CAM") (at 260 260 0) (unit 1) (uuid "{u4_uuid}") (in_bom yes) (on_board yes) (property "Reference" "U4" (at 260 245 0)) (property "Value" "ESP32-CAM" (at 260 275 0)))')
content.extend([
    kicad_wire(247.3, 250, 240, 250), kicad_label("5V_POWER", 240, 250),
    kicad_wire(247.3, 252.54, 240, 252.54), kicad_label("GND", 240, 252.54),
])

# --- FINALIZE ---
content.append(' (sheet_instances (path "/" (page "1")))')
content.append(' (symbol_instances')
for inst in instances:
    content.append(f'  (path "/{inst["uuid"]}" (reference "{inst["ref"]}") (unit {inst["unit"]}) (value "{inst["value"]}") (footprint "{inst["footprint"]}"))')
content.append(' )')
content.append(')')

with open('/Users/ryanmioduskiimac/Documents/GitHub/EdmundFitzgeraldController/docs/schematics/Edmund_Fitzgerald_Telemetry.kicad_sch', 'w') as f:
    f.write('\n'.join(content))
print("KiCAD Schematic Surgically Fixed - All previous work restored.")
