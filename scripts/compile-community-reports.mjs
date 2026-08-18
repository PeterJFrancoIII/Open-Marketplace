#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import ts from "typescript";

const fileUrl = new URL("../lib/community-reports.ts", import.meta.url);
const source = await readFile(fileUrl, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: fileUrl.pathname,
});
const { compileCommunityDigest } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

const input = process.argv[2];
const raw = input
  ? await readFile(input, "utf8")
  : await new Promise((resolve, reject) => {
      const chunks = [];
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => chunks.push(chunk));
      process.stdin.on("end", () => resolve(chunks.join("")));
      process.stdin.on("error", reject);
    });

if (!raw.trim()) {
  console.error(
    "Pass a JSON file of community report records, or pipe JSON on stdin.",
  );
  console.error(
    "Administrators can also open /admin/community or GET /api/community-reports?view=digest.",
  );
  process.exit(1);
}

const parsed = JSON.parse(raw);
const reports = Array.isArray(parsed) ? parsed : parsed.reports || [];
const digest = compileCommunityDigest(reports, new Date());
process.stdout.write(`${digest.markdown}\n`);
