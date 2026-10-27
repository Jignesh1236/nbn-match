import test from 'node:test';
import assert from 'node:assert/strict';

import { buildUploadOptions, normalizeDocumentMimeType } from '../src/lib/registration-service.ts';

test('upload options must carry metadata.mimetype derived from the file type', () => {
  const file = new File([new Uint8Array(4)], 'photo.jpg', { type: 'image/jpeg' });
  const options = buildUploadOptions(file);

  assert.equal(options.metadata.mimetype, 'image/jpeg');
  assert.equal(options.upsert, false);
});

test('normalizeDocumentMimeType resolves jfif/jpeg-like files to image/jpeg', () => {
  const file = new File([new Uint8Array(4)], 'photo.jfif', { type: '' });
  assert.equal(normalizeDocumentMimeType(file), 'image/jpeg');
});

test('buildUploadOptions also works for a plain object-shaped file input', () => {
  const file = { name: 'report.png', type: '' } as Pick<File, 'name' | 'type'>;
  const options = buildUploadOptions(file);
  assert.equal(options.metadata.mimetype, 'application/octet-stream');
  assert.equal(options.upsert, false);
});
