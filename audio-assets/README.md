# Audio Assets for DFPlayer Module

This folder contains MP3 files that will be uploaded to the DFPlayer Mini module (128MB built-in storage).

## DFPlayer Track Mapping

Upload these files to the DFPlayer via USB, then rename them on the module as numbered tracks.

| Track # | Filename | Description | Duration | Status |
|---------|----------|-------------|----------|--------|
| 001 | hull-breach.mp3 | "Hull breach detected" alert | TBD | ⏳ Pending |
| 002 | emergency.mp3 | "Emergency" alert | TBD | ⏳ Pending |
| 003 | all-clear.mp3 | "All clear" confirmation | TBD | ⏳ Pending |
| 004 | systems-normal.mp3 | "All systems normal" | TBD | ⏳ Pending |

## Adding New Sound Effects

1. **Record or source your MP3** (radio transmission style recommended)
2. **Save it here** with a descriptive filename
3. **Update the table above** with track number and description
4. **Upload to DFPlayer** via USB
5. **Rename on module** to match track number (001.mp3, 002.mp3, etc.)
6. **Update firmware** if adding new tracks (add endpoint)
7. **Update app** to add button for the new sound effect

## Firmware Integration

The firmware triggers tracks using serial commands:
```cpp
// Example: Play track 1 (hull-breach.mp3)
dfplayer.playTrack(1);
```

Each track gets its own HTTP endpoint:
- `POST /voice/1` → Track 001 (Hull Breach)
- `POST /voice/2` → Track 002 (Emergency)
- etc.

## App Integration

Each track gets a button in the "Radio Transmissions" panel of the app.

## Technical Notes

- **Module**: DFPlayer Mini Pro (128MB built-in storage)
- **Format**: MP3, mono or stereo
- **Bitrate**: 128kbps recommended
- **Sample Rate**: 44.1kHz or 48kHz
- **Max Files**: Limited by storage (~128MB = ~100 minutes @ 128kbps)
- **Upload Method**: USB connection to computer
