import fs from 'fs';

const path = 'index.test.js';
let code = fs.readFileSync(path, 'utf8');

// Replace all simple mockRun.mockResolvedValue without meta
// Line 210: POST beforeEach
code = code.replace(
  'mockRun.mockResolvedValue({ success: true });\n    });\n\n    it(\'should add a new expense successfully\'',
  'mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });\n    });\n\n    it(\'should add a new expense successfully\''
);

// Line 363: Explicit mock for successful delete
code = code.replace(
  'mockRun.mockResolvedValueOnce({ success: true }); // Explicitly mock for this test',
  'mockRun.mockResolvedValueOnce({ success: true, meta: { changes: 1 } }); // Explicitly mock for this test'
);

// Line 386: DELETE not found - simulate meta.changes=0
code = code.replace(
  'mockRun.mockResolvedValueOnce({ success: false }); // Simulate no rows affected',
  'mockRun.mockResolvedValueOnce({ success: true, meta: { changes: 0 } }); // Simulate no rows affected'
);

fs.writeFileSync(path, code);
console.log('Updated test mocks');
