import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceImage =
  'C:/Users/reeve/.gemini/antigravity/brain/c66aada3-a87d-44e6-8e16-f88b0a5f7d21/uploaded_image_1766928648257.jpg';
const readmeLogoPath = path.join(__dirname, '..', 'logo.png');

async function generate() {
  console.log(`Source: ${sourceImage}`);

  // Generate Logo for README
  console.log('Generating logo.png for README...');
  await sharp(sourceImage)
    .resize(300) // Keep aspect ratio, width 300
    .toFile(readmeLogoPath);

  console.log('Done!');
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
