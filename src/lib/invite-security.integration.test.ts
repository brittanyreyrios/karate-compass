import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

// Opt-in only: exact dedicated fixtures, never real invite codes or family accounts.
describe.skipIf(process.env['RUN_INVITE_SECURITY_TESTS'] !== '1')('invite security — live fixtures', () => {
  const email = 'zz.test.invitecheck@example.com';
  const fixtureCode = 'ZZTEST54';
  const url = process.env['SUPABASE_URL'] ?? '';
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'] ?? '';
  const admin = createClient(url || 'http://localhost', process.env['SUPABASE_SERVICE_ROLE_KEY'] || 'unused', { auth: { persistSession: false, autoRefreshToken: false } });
  let safeToDelete = false;
  let parentToken = '';
  let usedBefore = 0;
  const password = `${randomBytes(24).toString('base64url')}!Tg7`;
  const browserSignup = (code: string, expected: string) => execFileSync('python3', ['src/lib/invite-security.browser.py', expected], {
    env: { ...process.env, INVITE_TEST_EMAIL: email, INVITE_TEST_PASSWORD: password, INVITE_TEST_CODE: code },
    timeout: 90000, encoding: 'utf8',
  });

  beforeAll(async () => {
    if (!url || !key || !process.env['SUPABASE_SERVICE_ROLE_KEY']) throw new Error('Fixture environment unavailable');
    const existing = await admin.from('profiles').select('id').eq('email', email);
    expect(existing.error).toBeNull(); expect(existing.data).toEqual([]);
    const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    expect(users.error).toBeNull(); expect(users.data.users.some(u => u.email === email)).toBe(false);
    safeToDelete = true;
    const path = process.env['INVITE_TEST_SESSION_FILE'];
    if (!path?.startsWith('/tmp/browser/invite/')) throw new Error('Private parent fixture session required');
    parentToken = JSON.parse(readFileSync(path, 'utf8')).token;
    const before = await admin.from('invite_codes').select('active,used_count,max_uses').eq('code', fixtureCode).single();
    expect(before.error).toBeNull(); expect(before.data?.active).toBe(false); expect(before.data?.max_uses).toBe(20);
    usedBefore = before.data?.used_count ?? -1;
    expect((await admin.from('invite_codes').update({ active: true }).eq('code', fixtureCode)).error).toBeNull();
  });

  afterAll(async () => {
    // Independent cleanup jobs: disabling the code still runs if account cleanup fails.
    const results = await Promise.allSettled([
      (async () => {
        if (!safeToDelete) return;
        const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (users.error) throw new Error('Fixture cleanup lookup failed');
        const user = users.data.users.find(u => u.email === email);
        if (!user) return;
        const deleted = await admin.auth.admin.deleteUser(user.id);
        if (deleted.error) throw new Error('Fixture auth deletion failed');
        expect((await admin.from('profiles').delete().eq('id', user.id)).error).toBeNull();
        expect((await admin.from('user_roles').delete().eq('user_id', user.id)).error).toBeNull();
      })(),
      (async () => { expect((await admin.from('invite_codes').update({ active: false }).eq('code', fixtureCode)).error).toBeNull(); })(),
    ]);
    for (const result of results) if (result.status === 'rejected') throw result.reason;
  });

  it('denies signed-out check_invite_code execution', async () => {
    const response = await fetch(`${url}/rest/v1/rpc/check_invite_code`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ _code: fixtureCode }) });
    expect(response.ok).toBe(false); expect((await response.json()).code).toBe('42501');
  });
  it('denies authenticated parent check_invite_code execution', async () => {
    const response = await fetch(`${url}/rest/v1/rpc/check_invite_code`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${parentToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ _code: fixtureCode }) });
    expect(response.ok).toBe(false); expect((await response.json()).code).toBe('42501');
  });
  it('refuses the wrong fixture code at signup without consuming an invite', async () => {
    expect(browserSignup('ZZTEST54-WRONG', 'refused')).toContain('refused signup verified');
    const row = await admin.from('invite_codes').select('used_count').eq('code', fixtureCode).single();
    expect(row.data?.used_count).toBe(usedBefore);
    expect((await admin.from('profiles').select('id').eq('email', email)).data).toEqual([]);
  }, 100000);
  it('still signs up with ZZTEST54 through handle_new_user after all visitor grants are revoked', async () => {
    expect(browserSignup(fixtureCode, 'accepted')).toContain('accepted signup verified');
    const row = await admin.from('profiles').select('id,email').eq('email', email).single();
    expect(row.error).toBeNull(); expect(row.data?.email).toBe(email);
    const count = await admin.from('invite_codes').select('used_count').eq('code', fixtureCode).single();
    expect(count.data?.used_count).toBe(usedBefore + 1);
    const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = users.data.users.find(u => u.email === email);
    expect(user?.id).toBe(row.data?.id); expect(user?.email_confirmed_at).toBeFalsy();
  }, 100000);
});