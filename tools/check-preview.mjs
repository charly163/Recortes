/**
 * Diagnóstico rápido: prueba /api/preview contra los links que le pases.
 * Uso: node tools/check-preview.mjs https://youtube.com/watch?v=... https://github.com/...
 */
const base = process.env.BASE || 'http://localhost:4317';

const urls = process.argv.slice(2);
if (!urls.length) {
  console.error('Pasá al menos un link. Ej: node tools/check-preview.mjs https://github.com');
  process.exit(1);
}

for (const url of urls) {
  const started = Date.now();
  try {
    const res = await fetch(`${base}/api/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    const ms = Date.now() - started;
    if (!res.ok) {
      console.log(`✗ ${res.status} ${ms}ms  ${url}\n   ${data.error}`);
      continue;
    }
    console.log(`✓ ${res.status} ${ms}ms  ${url}`);
    console.log(`   plataforma: ${data.platform}   dominio: ${data.domain}`);
    console.log(`   título: ${data.title}`);
    console.log(`   imagen: ${data.imageToken ? `sí (${data.imageExt}, token ${data.imageToken.slice(0, 8)}…)` : 'no'}  ${data.imageSource ? `← ${data.imageSource.slice(0, 90)}` : ''}`);
    if (data.description) console.log(`   desc: ${data.description.slice(0, 120)}`);
    if (data.warnings?.length) console.log(`   avisos: ${data.warnings.join(' | ')}`);
  } catch (err) {
    console.log(`✗ ERROR ${url}: ${err.message}`);
  }
}
