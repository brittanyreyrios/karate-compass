import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

// Explicit opt-in and exact dedicated fixture identities; secrets stay in /tmp.
describe.skipIf(process.env.RUN_POST_IMAGE_TESTS !== "1")("post-image publication access — live fixtures", () => {
  let staff: SupabaseClient;
  let parent: SupabaseClient;
  let anon: SupabaseClient;
  let url: string;
  let key: string;
  const bucket = "post-images";
  const prefix = `zz-storage-security-${randomUUID()}`;
  const objects = ["announcement", "scheduled", "poll", "draft", "orphan"].map((n) => `${prefix}-${n}.jpg`);
  const rows: { table: "announcements" | "polls"; id: string }[] = [];
  let originalObjects: string[] = [];
  let publishedKeys = new Set<string>();
  const uploaded: string[] = [];
  const report: Record<string, unknown> = {};

  async function list(client: SupabaseClient) {
    const names: string[] = [];
    for (let offset = 0; ; offset += 100) {
      const r = await client.storage.from(bucket).list("", { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
      expect(r.error).toBeNull();
      for (const item of r.data ?? []) {
        // Recursively inspect any existing folders as well as bare object keys.
        if (item.id) names.push(item.name);
        else {
          for (let subOffset = 0; ; subOffset += 100) {
            const sub = await client.storage.from(bucket).list(item.name, { limit: 100, offset: subOffset });
            expect(sub.error).toBeNull();
            for (const child of sub.data ?? []) {
              if (!child.id) throw new Error("Nested folder requires explicit test coverage");
              names.push(`${item.name}/${child.name}`);
            }
            if ((sub.data?.length ?? 0) < 100) break;
          }
        }
      }
      if ((r.data?.length ?? 0) < 100) break;
    }
    return names.sort();
  }

  beforeAll(async () => {
    const path = process.env.POST_IMAGE_SESSION_FILE;
    if (!path?.startsWith("/tmp/browser/")) throw new Error("Private fixture session file required");
    const config = JSON.parse(readFileSync(path, "utf8"));
    expect(config.staff.id).toBe("d9db9608-b5d0-44f9-bbd4-b44514459708");
    expect(config.parent.email).toBe("zz.test.negative@example.com");
    url = config.url; key = config.key;
    const client = (token?: string) => createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    });
    staff = client(config.staff.token); parent = client(config.parent.token); anon = client();
    const identity = await parent.auth.getUser(config.parent.token);
    expect(identity.data.user?.email).toBe("zz.test.negative@example.com");
    originalObjects = await list(staff);
    const a = await staff.from("announcements").select("image_url").or("publish_at.is.null,publish_at.lte." + new Date().toISOString());
    const p = await staff.from("polls").select("image_url").eq("published", true);
    expect(a.error).toBeNull(); expect(p.error).toBeNull();
    publishedKeys = new Set([...a.data ?? [], ...p.data ?? []].map((r) => r.image_url).filter((v): v is string => !!v));
    const jpeg = readFileSync("/tmp/browser/post-image-security/fixture.jpg");
    for (const object of objects) {
      expect((await staff.storage.from(bucket).upload(object, jpeg, { contentType: "image/jpeg" })).error).toBeNull();
      uploaded.push(object);
    }
    for (const [index, scheduled] of [[0, false], [1, true]] as const) {
      const id = randomUUID();
      const r = await staff.from("announcements").insert({ id, category: "school_news", title: `${prefix} fixture`, body: "Temporary security fixture", image_url: objects[index], publish_at: scheduled ? "2099-01-01T00:00:00Z" : null, created_by: config.staff.id });
      expect(r.error).toBeNull(); rows.push({ table: "announcements", id });
    }
    for (const [index, published] of [[2, true], [3, false]] as const) {
      const id = randomUUID();
      const r = await staff.from("polls").insert({ id, question: `${prefix} fixture`, published, image_url: objects[index], created_by: config.staff.id });
      expect(r.error).toBeNull(); rows.push({ table: "polls", id });
    }
    publishedKeys.add(objects[0]); publishedKeys.add(objects[2]);
  }, 60000);

  async function signs(client: SupabaseClient, keys: string[]) {
    return client.storage.from(bucket).createSignedUrls(keys, 60);
  }
  afterAll(async () => {
    for (const row of rows) expect((await staff.from(row.table).delete().eq("id", row.id)).error).toBeNull();
    if (uploaded.length) expect((await staff.storage.from(bucket).remove(uploaded)).error).toBeNull();
    expect(await list(staff)).toEqual(originalObjects);
    for (const row of rows) expect((await staff.from(row.table).select("id").eq("id", row.id)).data).toEqual([]);
    report.cleanup = "All four fixture rows and five objects removed; original object inventory unchanged";
    writeFileSync("/tmp/browser/post-image-security/results.json", JSON.stringify(report, null, 2));
  }, 60000);

  it("a: parent signs and downloads a published announcement image", async () => {
    const r = await signs(parent, [objects[0]]);
    expect(r.error).toBeNull(); expect(r.data?.[0]?.error).toBeNull();
    const signed = r.data?.[0]?.signedUrl;
    expect(signed).toBeTruthy();
    if (!signed) throw new Error("No signed URL");
    const response = await fetch(signed);
    expect(response.status).toBe(200); expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
    report.a = "PASS: signed link returned and image downloaded (HTTP 200)";
  });
  it("b: parent cannot sign the known 2099 announcement key", async () => {
    const r = await signs(parent, [objects[1]]);
    expect(r.data?.[0]?.signedUrl ?? "").toBe("");
    expect(Boolean(r.error || r.data?.[0]?.error)).toBe(true);
    report.b = "PASS: no usable link; object-level access failure";
  });
  it("c: parent listing contains only images attached to published posts", async () => {
    const names = await list(parent);
    expect(names).toContain(objects[0]); expect(names).toContain(objects[2]);
    for (const name of names) expect(publishedKeys.has(name)).toBe(true);
    for (const index of [1, 3, 4]) expect(names).not.toContain(objects[index]);
    report.c = `PASS: ${names.length} listed keys all have published references; hidden fixtures absent`;
  });
  it("d: staff signs published and scheduled images and lists every object", async () => {
    const r = await signs(staff, [objects[0], objects[1]]);
    expect(r.error).toBeNull(); expect(r.data).toHaveLength(2);
    for (const row of r.data ?? []) { expect(row.error).toBeNull(); expect(row.signedUrl).toBeTruthy(); }
    expect(await list(staff)).toEqual([...originalObjects, ...objects].sort());
    report.d = "PASS: both links returned; full inventory includes all five fixture objects";
  });
  it("e: signed-out signing, listing and private download expose no objects", async () => {
    const r = await signs(anon, [objects[0]]);
    expect(r.data?.[0]?.signedUrl ?? "").toBe("");
    expect(Boolean(r.error || r.data?.[0]?.error)).toBe(true);
    const listed = await anon.storage.from(bucket).list();
    expect(listed.data ?? []).toEqual([]);
    const response = await fetch(`${url}/storage/v1/object/${bucket}/${objects[0]}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    expect(response.ok).toBe(false);
    report.e = `PASS: no link, empty/denied list, private download HTTP ${response.status}`;
  });
  it("f: parent can sign a published poll image but not an unpublished poll image", async () => {
    const r = await signs(parent, [objects[2], objects[3]]);
    expect(r.error).toBeNull(); expect(r.data?.[0]?.signedUrl).toBeTruthy();
    expect(r.data?.[1]?.signedUrl ?? "").toBe(""); expect(r.data?.[1]?.error).toBeTruthy();
    report.f = "PASS: published poll link returned; unpublished poll link denied";
  });
});