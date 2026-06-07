import fs from 'fs';

const path = 'index.test.js';
let code = fs.readFileSync(path, 'utf8');

// Fix PUT beforeEach (line ~281)
code = code.replace(
  "describe('PUT /api/expense', () => {\n    beforeEach(() => {\n        vi.clearAllMocks();\n        mockRun.mockResolvedValue({ success: true });",
  "describe('PUT /api/expense', () => {\n    beforeEach(() => {\n        vi.clearAllMocks();\n        mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });"
);

// Fix DELETE beforeEach (line ~356)
code = code.replace(
  "describe('DELETE /api/expense', () => {\n    beforeEach(() => {\n        vi.clearAllMocks();\n        mockRun.mockResolvedValue({ success: true });",
  "describe('DELETE /api/expense', () => {\n    beforeEach(() => {\n        vi.clearAllMocks();\n        mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });"
);

// Fix POST beforeEach (line ~210) 
code = code.replace(
  "describe('POST /api/expense', () => {\n    beforeEach(() => {\n        vi.clearAllMocks();\n        mockRun.mockResolvedValue({ success: true });",
  "describe('POST /api/expense', () => {\n    beforeEach(() => {\n        vi.clearAllMocks();\n        mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });"
);

fs.writeFileSync(path, code);
console.log('Fixed remaining mockResolvedValues');
