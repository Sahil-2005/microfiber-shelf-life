// test_extractors.js — Node.js unit tests for regex fabric extractors
const assert = require('assert');

// Mock window environment for extractors.js
global.window = {};
require('../extractors.js');
const ext = global.window.MicrofiberExtractors;

console.log('🧪 Running Microfiber Extractors Unit Tests...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✕ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// 1. Pure Cotton Extraction
test('Extract pure 100% cotton', () => {
  const res = ext.extractFabricInfo('Men Regular Fit 100% Cotton Solid Casual Shirt 180 GSM');
  assert.strictEqual(res.fabric_type, 'Cotton');
  assert.strictEqual(res.gsm, 180);
});

// 2. Pure Polyester Extraction
test('Extract 100% Polyester fleece', () => {
  const res = ext.extractFabricInfo('Heavyweight 100% Recycled Polyester Fleece Jacket 320 gsm plain weave');
  assert.strictEqual(res.fabric_type, 'Polyester');
  assert.strictEqual(res.gsm, 320);
  assert.strictEqual(res.weave, 'Plain');
});

// 3. Blend Percentages
test('Extract 60/40 cotton-polyester blend', () => {
  const res = ext.extractFabricInfo('Athletic Training Hoodie: 60% Cotton 40% Polyester 240 GSM');
  assert.ok(res.blend, 'Blend object should exist');
  assert.strictEqual(res.blend['Cotton'], 0.6);
  assert.strictEqual(res.blend['Polyester'], 0.4);
});

// 4. Nylon Ripstop
test('Extract Nylon & Weave', () => {
  const res = ext.extractFabricInfo('Lightweight 100% Nylon windbreaker with twill reinforcement');
  assert.strictEqual(res.fabric_type, 'Nylon');
  assert.strictEqual(res.weave, 'Twill');
});

// 5. Acrylic Knit
test('Extract Acrylic staple sweater', () => {
  const res = ext.extractFabricInfo('Classic 100% Acrylic chunky knit sweater 280gsm');
  assert.strictEqual(res.fabric_type, 'Acrylic');
  assert.strictEqual(res.gsm, 280);
});

// 6. Weave Types
test('Extract Plain, Twill, and Satin weaves', () => {
  assert.strictEqual(ext._extractWeave('smooth satin finish'), 'Satin');
  assert.strictEqual(ext._extractWeave('rugged twill construction'), 'Twill');
  assert.strictEqual(ext._extractWeave('woven plain cloth'), 'Plain');
});

// 7. Yarn Count
test('Extract yarn count Ne', () => {
  assert.strictEqual(ext._extractYarnCount('premium 40s count single jersey'), 40);
  assert.strictEqual(ext._extractYarnCount('30ne combed yarn'), 30);
});

console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

if (failed > 0) process.exit(1);
