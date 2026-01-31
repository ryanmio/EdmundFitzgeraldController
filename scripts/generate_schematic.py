import uuid

def gen_uuid():
    return str(uuid.uuid4())

def kicad_label(text, x, y, rot=0):
    return f'  (label "{text}" (at {x} {y} {rot}) (effects (font (size 1.27 1.27)) (justify left bottom)) (uuid "{gen_uuid()}"))'

def kicad_wire(x1, y1, x2, y2):
    return f'  (wire (pts (xy {x1} {y1}) (xy {x2} {y2})) (stroke (width 0) (type solid)) (uuid "{gen_uuid()}"))'

# --- SYMBOL DEFINITIONS ---
resistor_symbol = """
  (symbol "Device:R" (pin_numbers hide) (pin_names (offset 0)) (in_bom yes) (on_board yes)
   (property "Reference" "R" (at 2.032 0 90)) (property "Value" "R" (at 0 0 90))
   (symbol "R_0_1" (rectangle (start -1.016 -2.54) (end 1.016 2.54) (stroke (width 0.254)) (fill (type none))))
   (symbol "R_1_1"
    (pin passive line (at 0 3.81 270) (length 1.27) (name "~" (effects (font (size 1.27 1.27)))) (number "1"))
    (pin passive line (at 0 -3.81 90) (length 1.27) (name "~" (effects (font (size 1.27 1.27)))) (number "2")))
  )
"""

nmos_symbol = """
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
"""

led_symbol = """
  (symbol "Device:LED" (pin_numbers hide) (pin_names (offset 1.016) hide) (in_bom yes) (on_board yes)
   (property "Reference" "D" (at 0 2.54 0)) (property "Value" "LED" (at 0 -2.54 0))
   (symbol "LED_0_1"
    (polyline (pts (xy -1.27 -1.27) (xy -1.27 1.27) (xy 1.27 0) (xy -1.27 -1.27)) (stroke (width 0.254)) (fill (type none)))
    (polyline (pts (xy 1.27 -1.27) (xy 1.27 1.27)) (stroke (width 0.254))))
   (symbol "LED_1_1"
    (pin passive line (at -3.81 0 0) (length 2.54) (name "K" (effects (font (size 1.27 1.27)))) (number "1"))
    (pin passive line (at 3.81 0 180) (length 2.54) (name "A" (effects (font (size 1.27 1.27)))) (number "2")))
  )
"""

esp32_symbol = """
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
"""

content = [
    '(kicad_sch (version 20230121) (generator eeschema)',
    f' (uuid "{gen_uuid()}")',
    ' (paper "A3")',
    ' (title_block (title "Edmund Fitzgerald - Platform Telemetry") (company "Project Edmund Fitzgerald") (rev "1.2") (date "2026-01-31"))',
    ' (lib_symbols', resistor_symbol, nmos_symbol, led_symbol, esp32_symbol, ' )',
    '',
    # --- ESP32 Instance ---
    f' (symbol (lib_id "MCU_Espressif:ESP32-WROOM-32") (at 150 100 0) (unit 1) (uuid "{gen_uuid()}") (in_bom yes) (on_board yes) (fields_autoplaced yes)',
    '  (property "Reference" "U1" (at 150 75 0)) (property "Value" "ESP32_Control" (at 150 125 0)))',
    '',
    # --- RUNNING LIGHT MOSFET CIRCUIT ---
    # Resistor R1 (100 ohm) - Gate protection
    f' (symbol (lib_id "Device:R") (at 190 97.46 90) (unit 1) (uuid "{gen_uuid()}") (in_bom yes) (on_board yes) (fields_autoplaced yes)',
    '  (property "Reference" "R1" (at 190 92 0)) (property "Value" "100" (at 190 103 0)))',
    # Resistor R2 (10k ohm) - Pull-down
    f' (symbol (lib_id "Device:R") (at 210 110 0) (unit 1) (uuid "{gen_uuid()}") (in_bom yes) (on_board yes) (fields_autoplaced yes)',
    '  (property "Reference" "R2" (at 215 110 0)) (property "Value" "10k" (at 215 115 0)))',
    # MOSFET Q1 (N-Channel)
    f' (symbol (lib_id "Transistor_FET:Q_NMOS_GDS") (at 210 97.46 0) (unit 1) (uuid "{gen_uuid()}") (in_bom yes) (on_board yes) (fields_autoplaced yes)',
    '  (property "Reference" "Q1" (at 218 92 0)) (property "Value" "MOSFET_N" (at 218 97 0)))',
    # LED D1 (Running Light)
    f' (symbol (lib_id "Device:LED") (at 213.81 80 90) (unit 1) (uuid "{gen_uuid()}") (in_bom yes) (on_board yes) (fields_autoplaced yes)',
    '  (property "Reference" "D1" (at 213.81 75 0)) (property "Value" "Running_Light" (at 213.81 85 0)))',

    # --- WIRING FOR MOSFET CIRCUIT ---
    kicad_wire(165.24, 97.46, 186.19, 97.46), # ESP32 IO16 to R1
    kicad_wire(193.81, 97.46, 210, 97.46),   # R1 to Q1 Gate
    kicad_wire(210, 97.46, 210, 106.19),     # Q1 Gate to R2
    kicad_wire(210, 113.81, 210, 120),       # R2 to GND
    kicad_wire(213.81, 92.38, 213.81, 83.81), # Q1 Drain to LED Cathode
    kicad_wire(213.81, 76.19, 213.81, 70),   # LED Anode to Power
    kicad_wire(213.81, 102.54, 213.81, 120), # Q1 Source to GND
    
    kicad_label("8.4V_BATT", 213.81, 70, 90),
    kicad_label("GND", 210, 120, 90),
    kicad_label("GND", 213.81, 120, 90),
    kicad_label("RUN_GATE", 175, 95),

    # --- OTHER LABELS (Keep for reference) ---
    kicad_wire(134.76, 105.08, 120, 105.08), kicad_label("I2S_BCLK", 120, 105.08),
    kicad_wire(165.24, 115.24, 180, 115.24), kicad_label("I2S_DIN", 180, 115.24),
    kicad_wire(165.24, 112.7, 180, 112.7), kicad_label("I2S_LRC", 180, 112.7),
    ')'
]

with open('/Users/ryanmioduskiimac/Documents/GitHub/EdmundFitzgeraldController/docs/schematics/Edmund_Fitzgerald_Telemetry.kicad_sch', 'w') as f:
    f.write('\n'.join(content))
