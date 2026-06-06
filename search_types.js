import fs from 'fs';

const content = fs.readFileSync('node_modules/@google/genai/dist/genai.d.ts', 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.toLowerCase().includes('thought')) {
    console.log(`${i + 1}: ${line}`);
  }
}
