import assert from "node:assert/strict";
import test from "node:test";
import {
  compareInstagramExports,
  instagramProfileUrl,
  parseInstagramExport,
  readInstagramFiles,
} from "../src/lib/instagram-follow-checker";

const follower = (value: string) => ({ string_list_data: [{ value, href: "https://example.test/untrusted", timestamp: 1 }] });
const followersJson = (...usernames: string[]) => JSON.stringify(usernames.map(follower));
const followingJson = (...usernames: string[]) => JSON.stringify({
  relationships_following: usernames.map(title => ({ title, string_list_data: [{ href: "https://example.test/untrusted", timestamp: 1 }] })),
});

test("parses follower values and following titles from their respective export structures", () => {
  const followers = parseInstagramExport(`\uFEFF${followersJson("  Demo_Follower  ")}`, "followers");
  const following = parseInstagramExport(followingJson("Demo.Following"), "following");

  assert.deepEqual([...followers.usernames], [["demo_follower", "Demo_Follower"]]);
  assert.deepEqual([...following.usernames], [["demo.following", "Demo.Following"]]);
  assert.equal(followers.skipped + following.skipped, 0);
});

test("compares unique usernames case-insensitively and sorts accounts that do not follow back", () => {
  const followers = parseInstagramExport(followersJson(" Demo_Mutual ", "demo_mutual", "demo_follower"), "followers");
  const following = parseInstagramExport(followingJson("demo_Zeta", "DEMO_MUTUAL", "Demo_Alpha", " demo_alpha "), "following");

  assert.deepEqual(compareInstagramExports(followers, following), {
    followers: 2,
    following: 3,
    followingBack: 1,
    notFollowingBack: ["Demo_Alpha", "demo_Zeta"],
  });

  assert.deepEqual(compareInstagramExports(followers, parseInstagramExport(followingJson("demo_mutual"), "following")).notFollowingBack, []);
});

test("combines multiple follower files and deduplicates across shards", async () => {
  const result = await readInstagramFiles([
    new File([followersJson("Demo_First", "demo_shared")], "followers_1.json"),
    new File([followersJson("DEMO_SHARED", "demo_second")], "followers_2.json"),
  ], "followers");

  assert.equal(result.status, "ready");
  assert.deepEqual([...result.data.usernames], [["demo_first", "Demo_First"], ["demo_shared", "demo_shared"], ["demo_second", "demo_second"]]);
  const following = parseInstagramExport(followingJson("demo_second", "demo_solo"), "following");
  assert.deepEqual(compareInstagramExports(result.data, following).notFollowingBack, ["demo_solo"]);
});

test("accepts empty exports and rejects a blank or malformed file", () => {
  const followers = parseInstagramExport("[]", "followers");
  const following = parseInstagramExport('{"relationships_following":[]}', "following");
  assert.deepEqual(compareInstagramExports(followers, following), { followers: 0, following: 0, followingBack: 0, notFollowingBack: [] });

  assert.throws(() => parseInstagramExport(" \n ", "followers"), /file is empty/);
  assert.throws(() => parseInstagramExport("{invalid", "following"), /invalid JSON/);
});

test("rejects swapped exports and incorrect JSON structures", () => {
  assert.throws(() => parseInstagramExport(followingJson("demo_first"), "followers"), /followers JSON file/);
  assert.throws(() => parseInstagramExport(followersJson("demo_first"), "following"), /following JSON file/);
  assert.throws(() => parseInstagramExport("null", "followers"), /followers JSON file/);
  assert.throws(() => parseInstagramExport('{"relationships_following":{}}', "following"), /following JSON file/);
});

test("skips invalid usernames without falling back to embedded links or alternate fields", () => {
  const followers = parseInstagramExport(JSON.stringify([
    follower("demo_valid"),
    { title: "demo_wrong_field", string_list_data: [] },
    { string_list_data: [{ href: "https://example.test/demo_invalid" }, { value: "demo_second_value" }] },
    { string_list_data: [{ value: 42 }] },
    follower("javascript:alert(1)"),
    null,
  ]), "followers");
  assert.equal(followers.skipped, 5);
  assert.deepEqual([...followers.usernames.values()], ["demo_valid"]);

  const following = parseInstagramExport(JSON.stringify({ relationships_following: [
    { title: "Demo_Valid" },
    follower("demo_wrong_field"),
    { title: "demo/invalid" },
  ] }), "following");
  assert.equal(following.skipped, 2);
  assert.deepEqual([...following.usernames.values()], ["Demo_Valid"]);

  assert.throws(() => parseInstagramExport('[{"string_list_data":[{}]}]', "followers"), /No valid usernames/);
});

test("identifies a malformed shard and rejects an unreadable or oversized file", async () => {
  const result = await readInstagramFiles([
    new File([followersJson("demo_first")], "followers_1.json"),
    new File(["<html>wrong format</html>"], "followers_2.json"),
  ], "followers");
  assert.equal(result.status, "error");
  assert.equal(result.fileIndex, 1);
  assert.match(result.message, /invalid JSON/);

  const unreadable = await readInstagramFiles([{ size: 10, text: async () => { throw new Error("read error"); } }], "following");
  assert.equal(unreadable.status, "error");
  assert.match(unreadable.message, /couldn’t be read/);

  const oversized = await readInstagramFiles([{ size: 33 * 1024 * 1024, text: async () => assert.fail("Should not read oversized files") }], "following");
  assert.equal(oversized.status, "error");
  assert.match(oversized.message, /32 MB/);
});

test("cancels an in-flight read before it can produce results", async () => {
  const job = new AbortController();
  const read = readInstagramFiles([{ size: 16, text: async () => {
    job.abort();
    return followersJson("demo_first");
  } }], "followers", job.signal);

  await assert.rejects(read, { name: "AbortError" });
});

test("constructs safe Instagram profile URLs only for valid username segments", () => {
  assert.equal(instagramProfileUrl(" Demo.Name_1 "), "https://www.instagram.com/Demo.Name_1/");
  for (const invalid of ["", " ", ".", "..", "...", "name with spaces", "a".repeat(31), "//example.test", "a/b", "a\\b", "a?x=1", "a#fragment", "%2e%2e", "javascript:alert(1)", "<script>"]) {
    assert.equal(instagramProfileUrl(invalid), null);
  }
});
