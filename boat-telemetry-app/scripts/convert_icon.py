#!/usr/bin/env python3
"""Convert app icon to RGB format (remove transparency) for iOS requirements."""

from PIL import Image
import sys
import os

def convert_icon(input_path, output_path):
    """Convert icon to RGB format, removing transparency."""
    img = Image.open(input_path)
    
    if img.mode == 'RGBA':
        # Create white background and composite the image
        bg = Image.new('RGB', img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[3])  # Use alpha channel as mask
        bg.save(output_path, 'PNG')
        print(f"✓ Converted RGBA to RGB (removed transparency)")
    elif img.mode != 'RGB':
        # Convert other modes to RGB
        img.convert('RGB').save(output_path, 'PNG')
        print(f"✓ Converted {img.mode} to RGB")
    else:
        # Already RGB, just copy
        img.save(output_path, 'PNG')
        print(f"✓ Icon already in RGB format")
    
    # Verify output
    output_img = Image.open(output_path)
    print(f"✓ Output: {output_img.size[0]}x{output_img.size[1]}, Mode: {output_img.mode}")

if __name__ == '__main__':
    script_dir = os.path.dirname(os.path.abspath(__file__))
    assets_dir = os.path.join(script_dir, '..', 'assets')
    input_path = os.path.join(assets_dir, 'Icon-iOS-Default-1024x1024@1x.png')
    output_path = os.path.join(assets_dir, 'icon.png')
    
    if not os.path.exists(input_path):
        print(f"❌ Error: {input_path} not found")
        sys.exit(1)
    
    convert_icon(input_path, output_path)
    print(f"✓ Icon saved to: {output_path}")
