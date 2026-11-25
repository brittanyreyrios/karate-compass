import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Opt-in, read-only checks against exact fixtures after the browser lifecycle test.
// Session files stay private under /tmp/browser; no credentials belong in source.
describe.skipIf(process.env['RUN_TECHNIQUE_LIBRARY_TESTS'] !== '1')('shared technique library — fixtures', () => {
  const session = (role: 'parent' | 'staff') => {
    const path = `/tmp/browser/techniques/${role}-session.json`;
    return JSON.parse(readFileSync(path, 'utf8')) as { url: string; key: string; token: string };
  };
  const call = async (role: 'parent' | 'staff', anonymous = false) => {
    const s = session(role);
    const headers: Record<string, string> = { apikey: s.key, 'Content-Type': 'application/json' };
    if (!anonymous) headers['Authorization'] = `Bearer ${s.token}`;
    const response = await fetch(`${s.url}/rest/v1/rpc/get_technique_library`, {
      method: 'POST', headers, body: '{}',
    });
    return { response, body: await response.json() as unknown };
  };
  const records = (body: unknown) => {
    if (!Array.isArray(body)) throw new Error('Expected technique rows');
    return body as { id: string; label: string; published: boolean }[];
  };
  it('Tai Chi fixture sees all eight published techniques and both labels', async () => {
    const r = await call('parent');
    expect(r.response.ok).toBe(true);
    const rows = records(r.body);
    expect(rows).toHaveLength(8);
    expect(new Set(rows.map(row => row.label))).toEqual(new Set(['Jiu Jitsu', 'Wrestling']));
    expect(rows.every(row => row.published)).toBe(true);
  });
  it('staff retains the same eight existing rows after draft cleanup', async () => {
    const [parent, staff] = await Promise.all([call('parent'), call('staff')]);
    expect(staff.response.ok).toBe(true);
    expect(records(staff.body).map(row => row.id)).toEqual(records(parent.body).map(row => row.id));
  });
  it('signed-out execution is denied rather than returning content', async () => {
    const r = await call('parent', true);
    expect(r.response.ok).toBe(false);
    expect(r.body).toMatchObject({ code: '42501' });
  });
});