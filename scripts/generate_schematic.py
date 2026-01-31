import uuid

def gen_uuid():
    return str(uuid.uuid4())

def kicad_label(text, x, y, rot=0):
    return f'  (label "{text}" (at {x} {y} {rot}) (effects (font (size 1.27 1.27)) (justify left bottom)) (uuid "{gen_uuid()}"))'

def kicad_wire(x1, y1, x2, y2):
    return f'  (wire (pts (xy {x1} {y1}) (xy {x2} {y2})) (stroke (width 0) (type solid)) (uuid "{gen_uuid()}"))'

# Main ESP32 Symbol
esp32_symbol = """
  (symbol "MCU_Espressif:ESP32-WROOM-32" (pin_names (offset 1.016)) (in_bom yes) (on_board yes)
   (property "Reference" "U" (at -12.7 20.32 0))
   (property "Value" "ESP32-WROOM-32" (at 0 20.32 0))
   (symbol "ESP32-WROOM-32_0_1"
    (rectangle (start -12.7 -17.78) (end 12.7 17.78) (stroke (width 0.254)) (fill (type background)))
   )
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
    (pin bidirectional line (at 15.24 2.54 180) (length 2.54) (name "IO16" (effects (font (size 1.27 1.27)))) (number "25"))
   )
  )
"""

content = [
    '(kicad_sch (version 20230121) (generator eeschema)',
    f' (uuid "{gen_uuid()}")',
    ' (paper "A3")',
    ' (title_block (title "Edmund Fitzgerald - Platform Telemetry") (company "Project Edmund Fitzgerald") (rev "1.1") (date "2026-01-31"))',
    '',
    ' (lib_symbols',
    esp32_symbol,
    ' )',
    '',
    # ESP32 Instance at (150, 100)
    f' (symbol (lib_id "MCU_Espressif:ESP32-WROOM-32") (at 150 100 0) (unit 1) (uuid "{gen_uuid()}") (in_bom yes) (on_board yes) (fields_autoplaced yes)',
    '  (property "Reference" "U1" (at 150 75 0)) (property "Value" "ESP32_Control" (at 150 125 0)))',
    '',
    # --- WIRING FOR ALL PINS ---
    # Left Side Pins (X = 150 - 15.24 = 134.76)
    kicad_wire(134.76, 84.76, 120, 84.76), kicad_label("3V3", 120, 84.76), # Pin 1
    kicad_wire(134.76, 94.92, 120, 94.92), kicad_label("BAT_SENSE", 120, 94.92), # Pin 5 (IO34)
    kicad_wire(134.76, 100, 120, 100), kicad_label("WATER_SENSOR", 120, 100), # Pin 7 (IO32)
    kicad_wire(134.76, 105.08, 120, 105.08), kicad_label("I2S_BCLK", 120, 105.08), # Pin 9 (IO25)
    kicad_wire(134.76, 107.62, 120, 107.62), kicad_label("DFP_TX", 120, 107.62), # Pin 10 (IO26)
    kicad_wire(134.76, 110.16, 120, 110.16), kicad_label("DFP_RX", 120, 110.16), # Pin 11 (IO27)
    kicad_wire(150, 120.32, 150, 130), kicad_label("GND", 150, 130, 90), # Pin 15 (GND at bottom)

    # Right Side Pins (X = 150 + 15.24 = 165.24)
    kicad_wire(165.24, 115.24, 180, 115.24), kicad_label("I2S_DIN", 180, 115.24), # Pin 37
    kicad_wire(165.24, 112.7, 180, 112.7), kicad_label("I2S_LRC", 180, 112.7), # Pin 36
    kicad_wire(165.24, 110.16, 180, 110.16), kicad_label("FLOOD_GATE", 180, 110.16), # Pin 33 (IO21)
    kicad_wire(165.24, 107.62, 180, 107.62), kicad_label("SERVO_RC", 180, 107.62), # Pin 31 (IO19)
    kicad_wire(165.24, 105.08, 180, 105.08), kicad_label("THROTTLE_RC", 180, 105.08), # Pin 30 (IO18)
    kicad_wire(165.24, 102.54, 180, 102.54), kicad_label("FLOOD_LED", 180, 102.54), # Pin 26 (IO4)
    kicad_wire(165.24, 100, 180, 100), kicad_label("RUN_LED", 180, 100), # Pin 24 (IO2)
    kicad_wire(165.24, 97.46, 180, 97.46), kicad_label("RUN_GATE", 180, 97.46), # Pin 25 (IO16)

    # --- BLOCK DESCRIPTIONS (Manual placement around ESP32) ---
    f' (text "AUDIO SECTION" (at 210 110 0) (effects (font (size 2 2)) (justify left)))',
    f' (text "I2S: BCLK, LRC, DIN -> MAX98357A" (at 210 118 0) (effects (font (size 1 1)) (justify left)))',
    f' (text "UART: TX, RX -> DFPlayer Pro" (at 210 123 0) (effects (font (size 1 1)) (justify left)))',

    f' (text "LIGHTING SECTION" (at 210 90 0) (effects (font (size 2 2)) (justify left)))',
    f' (text "IO16/IO21 drive N-Channel MOSFET Gates" (at 210 98 0) (effects (font (size 1 1)) (justify left)))',

    f' (text "RC RECEIVER" (at 210 140 0) (effects (font (size 2 2)) (justify left)))',
    f' (text "Throttle (IO18), Servo (IO19) 5V PWM" (at 210 148 0) (effects (font (size 1 1)) (justify left)))',

    f' (text "POWER SENSE" (at 80 90 0) (effects (font (size 2 2)) (justify right)))',
    f' (text "100k/47k Resistor Divider for 8.4V sensing" (at 80 98 0) (effects (font (size 1 1)) (justify right)))',

    ')'
]

with open('/Users/ryanmioduskiimac/Documents/GitHub/EdmundFitzgeraldController/docs/schematics/Edmund_Fitzgerald_Telemetry.kicad_sch', 'w') as f:
    f.write('\n'.join(content))
print("KiCAD Schematic Updated Successfully.")
