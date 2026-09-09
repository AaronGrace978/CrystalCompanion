#!/usr/bin/env node
const { shouldDropInsert, shouldDropKey, shouldDropKeyAfterInsert, isImeKey } = require('../src/js/input-guard.js');
const assert = require('assert');

const field = { id: 'prompt' };

function insert(type, data, target = field) {
  return { inputType: type, data, target };
}

{
  const last = { t: 100, data: 'a', type: 'insertText', target: field };
  assert.strictEqual(
    shouldDropInsert(last, insert('insertText', 'a'), 108),
    true,
    'same-frame duplicate letter must drop'
  );
  assert.strictEqual(
    shouldDropInsert(last, insert('insertCompositionText', 'a'), 120),
    true,
    'IME + key mixed path must drop'
  );
  assert.strictEqual(
    shouldDropInsert(last, insert('insertText', 'a'), 160),
    false,
    'later identical letter is real typing'
  );
  assert.strictEqual(
    shouldDropInsert(last, insert('insertText', 'b'), 108),
    false,
    'different letter is not a duplicate'
  );
}

{
  const last = { t: 100, data: '', type: 'deleteContentBackward', target: field };
  assert.strictEqual(
    shouldDropInsert(last, { inputType: 'deleteContentBackward', data: null, target: field }, 106),
    true,
    'double backspace from OSK must drop'
  );
  assert.strictEqual(
    shouldDropInsert(last, { inputType: 'deleteContentBackward', data: null, target: field }, 180),
    false,
    'held/slow backspace must still work'
  );
}

{
  const other = { id: 'other' };
  const last = { t: 100, data: 'a', type: 'insertText', target: field };
  assert.strictEqual(
    shouldDropInsert(last, insert('insertText', 'a', other), 105),
    false,
    'other field is not a duplicate'
  );
}

{
  const last = { t: 50, key: 'a', code: 'KeyA', target: field };
  assert.strictEqual(
    shouldDropKey(last, { key: 'a', code: 'KeyA', target: field, repeat: false, isComposing: false, keyCode: 65 }, 55),
    true,
    'duplicate keydown must drop'
  );
  assert.strictEqual(
    shouldDropKey(last, { key: 'a', code: 'KeyA', target: field, repeat: true, isComposing: false, keyCode: 65 }, 55),
    false,
    'key repeat must not be treated as OSK double-fire'
  );
  assert.strictEqual(
    isImeKey({ isComposing: true, keyCode: 65, key: 'a' }),
    true
  );
  assert.strictEqual(
    isImeKey({ isComposing: false, keyCode: 229, key: 'Unidentified' }),
    true
  );
  assert.strictEqual(
    shouldDropKey(last, { key: 'a', code: 'KeyA', target: field, repeat: false, isComposing: true, keyCode: 229 }, 55),
    false,
    'IME keydown is not a duplicate key event'
  );
}

{
  const lastInsert = { t: 200, data: 'k', type: 'insertCompositionText', target: field };
  assert.strictEqual(
    shouldDropKeyAfterInsert(
      lastInsert,
      { key: 'k', target: field, repeat: false, isComposing: false, keyCode: 75 },
      210
    ),
    true,
    'keydown after IME insert of the same letter must drop'
  );
  assert.strictEqual(
    shouldDropKeyAfterInsert(
      lastInsert,
      { key: 'k', target: field, repeat: false, isComposing: false, keyCode: 75 },
      280
    ),
    false,
    'later keydown of the same letter is real typing'
  );
  assert.strictEqual(
    shouldDropKeyAfterInsert(
      lastInsert,
      { key: 'k', target: field, repeat: false, isComposing: false, keyCode: 75, ctrlKey: true },
      210
    ),
    false,
    'shortcuts must not be swallowed'
  );
}

console.log('input-guard tests passed');
