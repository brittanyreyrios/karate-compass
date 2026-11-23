import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { z } from "zod";

// Live tests require an explicit opt-in and only the approved dedicated accounts.
describe.skipIf(process.env['RUN_ALBUM_COVER_TESTS'] !== "1")("album-cover active-album access — fixtures", () => {
  const root = "/tmp/browser/album-cover-security";
  const bucket = "album-covers";
  const prefix = `zz-album-security-${randomUUID()}`;
  const activeKey = `${prefix}-active.jpg`;
  const hiddenKey = `${prefix}-inactive.jpg`;
  const orphanKey = `${prefix}-orphan.jpg`;
  const objects = [activeKey, hiddenKey, orphanKey];
  const activeId = randomUUID();
  const hiddenId = randomUUID();
  const createdRows: string[] = [];
  const uploaded: string[] = [];
  const report: Record<string, unknown> = {};
  let staff: SupabaseClient | undefined;
  let parent: SupabaseClient | undefined;
  let anon: SupabaseClient | undefined;
  let url = "";
  let key = "";
  let originalObjects: string[] = [];
  let originalAlbums: unknown;
  let originalChild: unknown;
  let activeReferences = new Set<string>();

  function required(client: SupabaseClient | undefined) {
    if (!client) throw new Error("Fixture client unavailable");
    return client;
  }

  async function list(client: SupabaseClient, folder = ""): Promise<string[]> {
    const names: string[] = [];
    for (let offset = 0; ; offset += 100) {
      const r = await client.storage.from(bucket).list(folder, {
        limit: 100, offset, sortBy: { column: "name", order: "asc" },
      });
      expect(r.error).toBeNull();
      for (const item of r.data ?? []) {
        const path = folder ? `${folder}/${item.name}` : item.name;
        if (item.id) names.push(path);
        else names.push(...await list(client, path));
      }
      if ((r.data?.length ?? 0) < 100) break;
    }
    return names.sort();
  }

  async function download(signed: string | null | undefined) {
    expect(signed).toBeTruthy();
    if (!signed) throw new Error("No usable signed URL");
    const response = await fetch(signed);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/jpeg");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  }

  beforeAll(async () => {
    const path = process.env['ALBUM_COVER_SESSION_FILE'];
    if (!path?.startsWith("/tmp/browser/")) throw new Error("Private fixture session file required");
    const account = z.object({ id: z.string().uuid(), email: z.string(), token: z.string().min(1) });
    const config = z.object({ url: z.string().url(), key: z.string().min(1), staff: account, parent: account })
      .parse(JSON.parse(readFileSync(path, "utf8")));
    expect(config.staff.id).toBe("d9db9608-b5d0-44f9-bbd4-b44514459708");
    expect(config.staff.email).toBe("leaguecity.tigersden+zzstaff@gmail.com");
    expect(config.parent.email).toBe("zz.test.negative@example.com");
    url = config.url; key = config.key;
    const client = (token?: string) => createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    });
    staff = client(config.staff.token); parent = client(config.parent.token); anon = client();
    for (const [c, fixture] of [[staff, config.staff], [parent, config.parent]] as const) {
      const identity = await c.auth.getUser(fixture.token);
      expect(identity.error).toBeNull();
      expect(identity.data.user?.id).toBe(fixture.id);
      expect(identity.data.user?.email).toBe(fixture.email);
    }
    originalObjects = await list(staff);
    const albums = await staff.from("gallery_albums").select("*").order("id");
    expect(albums.error).toBeNull(); originalAlbums = albums.data;
    activeReferences = new Set((albums.data ?? []).filter(a => a.active)
      .map(a => a.cover_image_url).filter((v): v is string => Boolean(v)));
    const child = await staff.from("students").select("*").eq("id", "9cec0efd-4cff-4d53-98b0-041198d4256c");
    expect(child.error).toBeNull(); originalChild = child.data;
    writeFileSync(`${root}/manifest.json`, JSON.stringify({ prefix, albumIds: [activeId, hiddenId], objects }, null, 2));
    const jpeg = readFileSync(`${root}/fixture.jpg`);
    for (const object of objects) {
      const r = await staff.storage.from(bucket).upload(object, jpeg, { contentType: "image/jpeg" });
      expect(r.error).toBeNull(); uploaded.push(object);
    }
    for (const [id, cover, active] of [[activeId, activeKey, true], [hiddenId, hiddenKey, false]] as const) {
      const r = await staff.from("gallery_albums").insert({
        id, title: `${prefix} ${active ? "active" : "inactive"}`,
        external_url: "https://portal.tigersdenmartialarts.com", cover_image_url: cover, active,
      });
      expect(r.error).toBeNull(); createdRows.push(id);
    }
    activeReferences.add(activeKey);
  }, 60000);

  afterAll(async () => {
    if (!staff) return;
    // Attempt every cleanup operation before failing so one error cannot strand the rest.
    const errors: string[] = [];
    for (const id of createdRows) {
      const r = await staff.from("gallery_albums").delete().eq("id", id);
      if (r.error) errors.push(`Album cleanup failed: ${id}`);
    }
    if (uploaded.length) {
      const r = await staff.storage.from(bucket).remove(uploaded);
      if (r.error) errors.push("Object cleanup failed");
    }
    report.fixtureIds = [activeId, hiddenId]; report.fixtureObjects = objects;
    report.cleanupErrors = errors;
    writeFileSync(`${root}/results.json`, JSON.stringify(report, null, 2));
    expect(errors).toEqual([]);
    expect(await list(staff)).toEqual(originalObjects);
    const rows = await staff.from("gallery_albums").select("*").order("id");
    expect(rows.error).toBeNull(); expect(rows.data).toEqual(originalAlbums);
    const child = await staff.from("students").select("*").eq("id", "9cec0efd-4cff-4d53-98b0-041198d4256c");
    expect(child.error).toBeNull(); expect(child.data).toEqual(originalChild);
    report.cleanup = "Two albums and three JPEGs removed; original albums, object inventory, and permanent child unchanged";
    writeFileSync(`${root}/results.json`, JSON.stringify(report, null, 2));
  }, 60000);

  it("a: parent signs and retrieves the active-album JPEG", async () => {
    const r = await required(parent).storage.from(bucket).createSignedUrls([activeKey], 60);
    expect(r.error).toBeNull(); expect(r.data?.[0]?.error).toBeNull();
    await download(r.data?.[0]?.signedUrl);
    report.a = "PASS: usable signed link, JPEG retrieved HTTP 200";
  });

  it("b: parent gets per-object denials for inactive and unattached covers", async () => {
    const r = await required(parent).storage.from(bucket).createSignedUrls([hiddenKey, orphanKey], 60);
    expect(r.data).toHaveLength(2);
    for (const result of r.data ?? []) {
      expect(result.signedUrl ?? "").toBe(""); expect(result.error).toBeTruthy();
    }
    report.b = "PASS: both per-object errors checked; no usable links for inactive or unattached JPEG";
  });

  it("c: paginated parent listing exposes only exact active-album references", async () => {
    const names = await list(required(parent));
    expect(names).toContain(activeKey);
    expect(names).not.toContain(hiddenKey); expect(names).not.toContain(orphanKey);
    for (const name of names) expect(activeReferences.has(name)).toBe(true);
    report.c = `PASS: all ${names.length} listed keys attached to active albums; inactive/orphan fixtures absent`;
  });

  it("d: staff signs both covers and lists every object", async () => {
    const r = await required(staff).storage.from(bucket).createSignedUrls([activeKey, hiddenKey], 60);
    expect(r.error).toBeNull(); expect(r.data).toHaveLength(2);
    for (const result of r.data ?? []) {
      expect(result.error).toBeNull(); await download(result.signedUrl);
    }
    expect(await list(required(staff))).toEqual([...originalObjects, ...objects].sort());
    report.d = "PASS: both JPEGs signed/retrieved; full listing matches baseline plus all three fixtures";
  });

  it("e: signed-out signing, listing and direct downloads expose nothing", async () => {
    const r = await required(anon).storage.from(bucket).createSignedUrls(objects, 60);
    expect(Boolean(r.error) || (r.data ?? []).every(row => Boolean(row.error))).toBe(true);
    for (const result of r.data ?? []) expect(result.signedUrl ?? "").toBe("");
    const listing = await required(anon).storage.from(bucket).list();
    expect(listing.data ?? []).toEqual([]);
    const statuses: number[] = [];
    for (const object of objects) {
      const response = await fetch(`${url}/storage/v1/object/${bucket}/${object}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      expect(response.ok).toBe(false); statuses.push(response.status);
    }
    report.e = `PASS: no usable links, empty/denied list, private downloads HTTP ${statuses.join("/")}`;
  });
});