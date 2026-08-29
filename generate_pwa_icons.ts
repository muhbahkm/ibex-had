import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SRC_LOGO = path.join(process.cwd(), 'src/assets/bahkm-honey-logo-header-ready.png');
const PUBLIC_ASSETS_DIR = path.join(process.cwd(), 'public/assets');
const PUBLIC_ICONS_DIR = path.join(process.cwd(), 'public/icons');

async function run() {
  console.log('Starting PWA assets generation and copying...');

  // Ensure directories exist
  if (!fs.existsSync(PUBLIC_ASSETS_DIR)) {
    fs.mkdirSync(PUBLIC_ASSETS_DIR, { recursive: true });
  }
  if (!fs.existsSync(PUBLIC_ICONS_DIR)) {
    fs.mkdirSync(PUBLIC_ICONS_DIR, { recursive: true });
  }

  // Copy logo to public/assets/bahkm-honey-logo-header-ready.png
  const destLogo = path.join(PUBLIC_ASSETS_DIR, 'bahkm-honey-logo-header-ready.png');
  fs.copyFileSync(SRC_LOGO, destLogo);
  console.log(`Successfully copied logo to: ${destLogo}`);

  // Base icon generation details: we resize the logo to fit within the box.
  // The logo is rectangular, so we will fit it inside the square with padding.
  
  // Standard PWA icon (transparent background)
  const sizes = [192, 512];
  for (const size of sizes) {
    const destPath = path.join(PUBLIC_ICONS_DIR, `icon-${size}.png`);
    await sharp(SRC_LOGO)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent
      })
      .toFile(destPath);
    console.log(`Generated standard PWA icon: ${destPath}`);
  }

  // Maskable icons (solid honey background #D98200)
  for (const size of sizes) {
    const destPath = path.join(PUBLIC_ICONS_DIR, `maskable-${size}.png`);
    
    // Resize the logo to fit inside with a bit more padding (70% of size) so it doesn't get clipped by the OS safe zone
    const innerSize = Math.round(size * 0.7);
    const logoResized = await sharp(SRC_LOGO)
      .resize(innerSize, innerSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toBuffer();

    // Composite logo-resized on top of a solid color background
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 217, g: 130, b: 0, alpha: 1 } // #D98200
      }
    })
    .composite([{ input: logoResized, gravity: 'center' }])
    .toFile(destPath);
    
    console.log(`Generated maskable PWA icon: ${destPath}`);
  }

  console.log('All PWA icons generated successfully!');
}

run().catch((err) => {
  console.error('Failed to generate PWA assets:', err);
  process.exit(1);
});
