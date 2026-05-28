const PptxGenJS = require('pptxgenjs');
const fs = require('fs');

const pres = new PptxGenJS();

function addTitleSlide(title, subtitle) {
  let slide = pres.addSlide();
  slide.addText(title, { x: 0.5, y: 1.5, fontSize: 36, bold: true });
  slide.addText(subtitle, { x: 0.5, y: 2.5, fontSize: 18, color: '666666' });
}

function addBullets(title, bullets) {
  let slide = pres.addSlide();
  slide.addText(title, { x: 0.5, y: 0.4, fontSize: 28, bold: true });
  slide.addText(bullets.map(b => ({ text: b, options: { fontSize: 16 } })), { x: 0.5, y: 1.2, w: '90%', h: 4.5, color: '333333' });
}

addTitleSlide('ALEO zPass — Age Verification Demo', new Date().toISOString().slice(0,10));

addBullets('Architecture Overview', [
  'Frontend: Next.js (port 3000) — holder & verifier UIs',
  'Auth Backend: Express + Prisma (port 4000) — nonce, proof, JWTs',
  'Content Backend: Express (port 4001) — serves gated content, checks revocation'
]);

addBullets('ZKP Age Verification Workflow', [
  '1) GET /auth/nonce — server stores one-time nonce (5min)',
  '2) GET /issuer/credential-by-email — obtain credential metadata (no age)',
  '3) POST /auth/verify — backend validates nonce + revocation',
  '4) Backend runs: leo run prove_age_over_18 ${age}u8',
  '5) Backend issues short-lived JWT (15m) with claim isAdult',
  '6) Content backend re-checks revocation per request'
]);

addBullets('Security Properties', [
  'One-time nonce to prevent replay',
  'Revocation checked before proof and at content access',
  'Short-lived JWT (15 minutes)',
  'Rate limiting on /auth/verify (5/min per IP)',
  'Leo proves boolean only — age never revealed'
]);

addBullets('Database Models (Prisma)', [
  'Credential: holderEmail, age, country, isRevoked, proofTxId, issuerSignature',
  'Nonce: id(uuid), value, used(bool), expiresAt',
  'User: issuer accounts (admin/issuer)'
]);

addBullets('Key Endpoints', [
  'GET /auth/nonce',
  'POST /auth/verify (SSE + token)',
  'GET /issuer/credential-by-email?email=',
  'GET /auth/check-revocation/:credentialId'
]);

addBullets('Developer Commands', [
  'From backend/: npx ts-node --transpile-only src/index.ts',
  'From backend-content/: npm run dev',
  'From frontend/: npm run dev',
  'Leo proof: leo run prove_age_over_18 25u8'
]);

addBullets('Content Gating', [
  'isAdult=true → Adult tiles: Premium, Marketplace, Finance, Gaming',
  'isAdult=false → Minor tiles: Education, Youth Games, Story World, Creative Studio'
]);

addBullets('Next Steps', [
  'Add visual architecture diagram (SVG/PNG) to slide',
  'Tailor slides for technical or management audience',
  'Review and finalize with stakeholders'
]);

const outDir = 'docs';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = `${outDir}/aleo-zpass-demo-presentation.pptx`;

pres.writeFile(outPath).then(() => {
  console.log(`Saved presentation to ${outPath}`);
}).catch(err => {
  console.error('Error saving presentation:', err);
});
