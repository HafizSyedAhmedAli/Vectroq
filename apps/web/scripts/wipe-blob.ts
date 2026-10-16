import { list, del } from "@vercel/blob";

async function main() {
  let cursor: string | undefined;
  do {
    const r = await list({ prefix: "lead-plans/", cursor });
    if (r.blobs.length) await del(r.blobs.map((b) => b.url));
    cursor = r.cursor;
  } while (cursor);
  console.log("Done");
}
main();
