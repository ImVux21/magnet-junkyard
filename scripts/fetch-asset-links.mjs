const packs = [
  'top-down-tanks',
  'particle-pack',
  'impact-sounds',
  'interface-sounds',
  'sci-fi-sounds',
  'ui-pack',
  'ui-pack-space-expansion',
  'generic-items',
  'space-kit'
];

async function main() {
  for (const slug of packs) {
    try {
      const res = await fetch(`https://kenney.nl/assets/${slug}`);
      if (!res.ok) {
        console.log(`${slug}: HTTP ${res.status}`);
        continue;
      }
      const html = await res.text();
      const match = html.match(/id=['"]donate-text['"]\s+href=['"]([^'"]+)['"]/);
      if (match) {
        console.log(`${slug}: ${match[1]}`);
      } else {
        console.log(`${slug}: No download link found`);
      }
    } catch (e) {
      console.error(`${slug}: ${e.message}`);
    }
  }
}

main();
