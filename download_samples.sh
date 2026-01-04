#!/bin/bash

# Script to download all tonejs-instruments samples locally

BASE_URL="https://nbrosowsky.github.io/tonejs-instruments/samples"
DEST_DIR="/workspaces/AudioVerse/samples"

# List of all instruments
INSTRUMENTS=(
    "bass-electric:As1 As2 As3 As4 Cs1 Cs2 Cs3 Cs4 E1 E2 E3 E4 G1 G2 G3 G4"
    "bassoon:A2 A3 A4 C3 C4 C5 E4 G2 G3 G4"
    "cello:C2 C3 C4 C5 Cs3 Cs4 D2 D3 D4 Ds2 Ds3 Ds4 E2 E3 E4 F2 F3 F4 Fs3 Fs4 G2 G3 G4 Gs2 Gs3 Gs4 A2 A3 A4 As2 As3 B2 B3 B4"
    "clarinet:D3 D4 D5 D6 F3 F4 F5 F6 As3 As4 As5 As6"
    "contrabass:As1 Cs1 E1 G1"
    "flute:A5 C3 C4 C5 C6 E3 E4 E5"
    "french-horn:A2 A4 C1 C3 D2 D4 Ds1 Ds3 F2 F4"
    "guitar-acoustic:A2 A3 A4 A5 C3 C4 C5 Ds4 E2 E3 E4 Fs2 Fs3 Fs4"
    "guitar-electric:As2 As3 As4 As5 Cs3 Cs4 Cs5 E2 E3 E4 E5 Fs2 Fs3 Fs4 Fs5"
    "guitar-nylon:As2 As3 As4 Cs3 Cs4 Cs5 E2 E3 E4 Fs2 Fs3 Fs4"
    "harmonium:A2 A3 A4 C2 C3 C4 C5 Ds2 Ds3 Ds4 Fs2 Fs3 Fs4"
    "harp:A5 C4 C5 C6 C7 Ds4 Ds5 Ds6 Ds7 Fs4 Fs5 Fs6"
    "organ:A3 A4 A5 C3 C4 C5 C6 Ds3 Ds4 Ds5 Ds6 Fs3 Fs4 Fs5"
    "piano:A1 A2 A3 A4 A5 A6 A7 As1 As2 As3 As4 As5 As6 As7 B1 B2 B3 B4 B5 B6 B7 C1 C2 C3 C4 C5 C6 C7 C8 Cs1 Cs2 Cs3 Cs4 Cs5 Cs6 Cs7 D1 D2 D3 D4 D5 D6 D7 Ds1 Ds2 Ds3 Ds4 Ds5 Ds6 Ds7 E1 E2 E3 E4 E5 E6 E7 F1 F2 F3 F4 F5 F6 F7 Fs1 Fs2 Fs3 Fs4 Fs5 Fs6 Fs7 G1 G2 G3 G4 G5 G6 G7 Gs1 Gs2 Gs3 Gs4 Gs5 Gs6 Gs7"
    "saxophone:Ds4 Ds5 Ds6 F3 F4 F5 F6 As3 As4 As5 C3 C4 C5"
    "trombone:As1 As2 As3 C3 C4 Cs2 Cs4 D3 D4 Ds2 Ds3 Ds4 F2 F3 F4 Gs2 Gs3"
    "trumpet:A3 A5 As4 C4 C6 D5 Ds4 F3 F4 F5 G4"
    "tuba:As1 As2 As3 D2 D3 D4 Ds2 F1 F2 F3"
    "violin:A3 A4 A5 A6 C4 C5 C6 C7 E4 E5 E6 G4 G5 G6"
    "xylophone:C5 C6 C7 C8 G4 G5 G6 G7"
)

echo "Starting sample download..."

for entry in "${INSTRUMENTS[@]}"; do
    IFS=':' read -r instrument notes <<< "$entry"
    
    echo "Downloading $instrument..."
    mkdir -p "$DEST_DIR/$instrument"
    
    for note in $notes; do
        url="$BASE_URL/$instrument/${note}.mp3"
        dest="$DEST_DIR/$instrument/${note}.mp3"
        
        if [ ! -f "$dest" ]; then
            wget -q "$url" -O "$dest" 2>/dev/null
            if [ $? -eq 0 ]; then
                echo "  ✓ ${note}.mp3"
            else
                echo "  ✗ Failed: ${note}.mp3"
            fi
        else
            echo "  - ${note}.mp3 (already exists)"
        fi
    done
done

echo ""
echo "Download complete!"
echo "Total size:"
du -sh "$DEST_DIR"
