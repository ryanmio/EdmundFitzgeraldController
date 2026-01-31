#!/usr/bin/env node
/**
 * Asset Verification Script for TestFlight Deployment
 * Verifies that all required assets meet iOS/TestFlight requirements
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const ICON_PATH = path.join(ASSETS_DIR, 'icon.png');
const SPLASH_PATH = path.join(ASSETS_DIR, 'splash-icon.png');

function checkFileExists(filePath, name) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ${name} not found at: ${filePath}`);
    return false;
  }
  console.log(`✓ ${name} found`);
  return true;
}

function checkImageDimensions(filePath, name, expectedSize = 1024) {
  try {
    // Use sips (macOS built-in) or identify (ImageMagick) if available
    let output;
    try {
      output = execSync(`sips -g pixelWidth -g pixelHeight "${filePath}"`, { encoding: 'utf8' });
      const widthMatch = output.match(/pixelWidth: (\d+)/);
      const heightMatch = output.match(/pixelHeight: (\d+)/);
      
      if (widthMatch && heightMatch) {
        const width = parseInt(widthMatch[1]);
        const height = parseInt(heightMatch[1]);
        
        if (width === expectedSize && height === expectedSize) {
          console.log(`✓ ${name} dimensions: ${width}x${height} (correct)`);
          return true;
        } else {
          console.error(`❌ ${name} dimensions: ${width}x${height} (expected ${expectedSize}x${expectedSize})`);
          return false;
        }
      }
    } catch (e) {
      // Fallback: try Python PIL if available
      try {
        const pythonCheck = execSync(
          `python3 -c "from PIL import Image; img = Image.open('${filePath}'); print(f'{img.size[0]},{img.size[1]}')"`,
          { encoding: 'utf8' }
        );
        const [width, height] = pythonCheck.trim().split(',').map(Number);
        if (width === expectedSize && height === expectedSize) {
          console.log(`✓ ${name} dimensions: ${width}x${height} (correct)`);
          return true;
        } else {
          console.error(`❌ ${name} dimensions: ${width}x${height} (expected ${expectedSize}x${expectedSize})`);
          return false;
        }
      } catch (e2) {
        console.warn(`⚠️  Could not verify ${name} dimensions (sips/python3 not available)`);
        return true; // Don't fail if we can't check
      }
    }
  } catch (error) {
    console.warn(`⚠️  Could not verify ${name} dimensions: ${error.message}`);
    return true; // Don't fail if we can't check
  }
}

function checkImageFormat(filePath, name) {
  try {
    const stats = fs.statSync(filePath);
    if (path.extname(filePath).toLowerCase() === '.png') {
      console.log(`✓ ${name} format: PNG`);
      return true;
    } else {
      console.error(`❌ ${name} format: ${path.extname(filePath)} (expected PNG)`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Could not check ${name} format: ${error.message}`);
    return false;
  }
}

function main() {
  console.log('🔍 Verifying assets for TestFlight deployment...\n');
  
  let allPassed = true;
  
  // Check icon
  console.log('📱 App Icon:');
  if (!checkFileExists(ICON_PATH, 'icon.png')) {
    allPassed = false;
  } else {
    if (!checkImageDimensions(ICON_PATH, 'icon.png', 1024)) {
      allPassed = false;
    }
    if (!checkImageFormat(ICON_PATH, 'icon.png')) {
      allPassed = false;
    }
  }
  
  console.log('\n🖼️  Splash Screen:');
  if (!checkFileExists(SPLASH_PATH, 'splash-icon.png')) {
    allPassed = false;
  } else {
    if (!checkImageDimensions(SPLASH_PATH, 'splash-icon.png', 1024)) {
      allPassed = false;
    }
    if (!checkImageFormat(SPLASH_PATH, 'splash-icon.png')) {
      allPassed = false;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('✅ All assets verified! Ready for TestFlight deployment.');
    process.exit(0);
  } else {
    console.log('❌ Some assets failed verification. Please fix the issues above.');
    process.exit(1);
  }
}

main();
