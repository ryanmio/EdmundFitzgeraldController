/*
 * DFPlayer PRO (DFR0768 / DF1201S) Test for ESP32
 * 
 * CRITICAL: This is DFPlayer PRO, NOT DFPlayer Mini!
 * - Uses AT commands with CRLF ("\r\n")
 * - Baud rate: 115200 (NOT 9600!)
 * - Library: DFRobot_DF1201S (NOT DFRobotDFPlayerMini)
 * - File numbering: Based on WRITE ORDER to module, not filename!
 * 
 * WIRING:
 * - DFPlayer Pro VIN    → ESP32 3.3V (or 5V with level shifter on TX)
 * - DFPlayer Pro GND    → ESP32 GND
 * - DFPlayer Pro RX     → ESP32 GPIO26 (TX2) - Module receives
 * - DFPlayer Pro TX     → ESP32 GPIO27 (RX2) - Module transmits
 * - Speaker 4Ω 3W       → L+ and L- (or R+ and R-)
 * 
 * Library: Install via Arduino Library Manager
 * Search: "DFRobot_DF1201S" by DFRobot
 */

#include "DFRobot_DF1201S.h"

// Pin definitions - CROSS WIRED!
#define DFPLAYER_RX_PIN  27  // ESP32 receives from DFPlayer TX
#define DFPLAYER_TX_PIN  26  // ESP32 transmits to DFPlayer RX

// Create DF1201S object
DFRobot_DF1201S DF1201S;

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n\n");
  Serial.println("╔════════════════════════════════════════════════════╗");
  Serial.println("║  DFPlayer PRO (DF1201S) Test - CORRECT PROTOCOL   ║");
  Serial.println("╚════════════════════════════════════════════════════╝");
  Serial.println();
  Serial.println("Device: DFPlayer Pro (DFR0768) with DF1201S chip");
  Serial.println("Protocol: AT commands with CRLF");
  Serial.println("Baud: 115200 (NOT 9600!)");
  Serial.println();
  
  // Initialize Serial2 for DFPlayer Pro at 115200 baud
  Serial.println("[1] Initializing UART2 at 115200 baud...");
  Serial.print("    ESP32 GPIO");
  Serial.print(DFPLAYER_TX_PIN);
  Serial.println(" (TX) → DFPlayer RX");
  Serial.print("    ESP32 GPIO");
  Serial.print(DFPLAYER_RX_PIN);
  Serial.println(" (RX) ← DFPlayer TX");
  
  Serial2.begin(115200, SERIAL_8N1, DFPLAYER_RX_PIN, DFPLAYER_TX_PIN);
  delay(1000);
  Serial.println("[1] UART2 initialized");
  Serial.println();
  
  // Initialize DF1201S
  Serial.println("[2] Initializing DFPlayer Pro library...");
  
  if (!DF1201S.begin(Serial2)) {
    Serial.println();
    Serial.println("✗✗✗ DFPlayer Pro initialization FAILED! ✗✗✗");
    Serial.println();
    Serial.println("Possible issues:");
    Serial.println("  1. Wrong device - is this actually DFPlayer MINI?");
    Serial.println("  2. TX/RX wires swapped");
    Serial.println("  3. Bad connection or loose wire");
    Serial.println("  4. Module not powered (check 3.3V or 5V)");
    Serial.println("  5. No audio files on module storage");
    Serial.println();
    Serial.println("Does manual PLAY button work? (verifies hardware)");
    Serial.println();
    while(1) delay(1000);
  }
  
  Serial.println("[2] ✓ DFPlayer Pro connected!");
  Serial.println();
  
  // Switch to MUSIC mode (required before playback)
  Serial.println("[3] Switching to MUSIC mode...");
  DF1201S.switchFunction(DF1201S.MUSIC);
  delay(2000);  // Wait for prompt tone to finish (per wiki)
  Serial.println("[3] Music mode active");
  Serial.println();
  
  // Enable amplifier
  Serial.println("[4] Enabling amplifier...");
  DF1201S.setPlayMode(DF1201S.SINGLE);  // Play once
  delay(200);
  Serial.println("[4] Amplifier ready");
  Serial.println();
  
  // Set volume (0-30)
  Serial.println("[5] Setting volume to 20/30...");
  DF1201S.setVol(20);
  delay(300);
  Serial.println("[5] Volume set");
  Serial.println();
  
  // Play file #1 (based on write order, not filename!)
  Serial.println("[6] Playing file #1...");
  Serial.println();
  Serial.println("    ╔═══════════════════════════════════════╗");
  Serial.println("    ║  *** LISTEN FOR AUDIO NOW! ***       ║");
  Serial.println("    ╚═══════════════════════════════════════╝");
  Serial.println();
  Serial.println("    Note: File #1 = first file written to module");
  Serial.println("          (NOT necessarily 0001.mp3!)");
  Serial.println();
  
  DF1201S.playFileNum(1);
  
  // Wait and check status
  for(int i = 0; i < 10; i++) {
    delay(1000);
    Serial.print("    Waiting... ");
    Serial.print(i+1);
    Serial.println("/10 seconds");
  }
  
  Serial.println();
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Serial.println("STARTUP TEST COMPLETE");
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Serial.println();
  Serial.println("Did you hear audio?");
  Serial.println("  YES → Success! Integration ready.");
  Serial.println("  NO  → Check speaker wiring to L+/L-");
  Serial.println();
  Serial.println("Entering loop - will play files 1, 2, 3 repeatedly...");
  Serial.println();
}

void loop() {
  static int currentFile = 1;
  static unsigned long lastPlay = 0;
  
  // Play next file every 15 seconds
  if (millis() - lastPlay > 15000) {
    lastPlay = millis();
    
    Serial.print("Playing file #");
    Serial.println(currentFile);
    
    DF1201S.playFileNum(currentFile);
    
    // Cycle through files 1, 2, 3
    currentFile++;
    if (currentFile > 3) currentFile = 1;
  }
  
  delay(100);
}
