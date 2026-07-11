#!/usr/bin/env node
// Run by .github/workflows/release.yml after CI passes on a push to main.
// Classifies HEAD's commit (conventional-commit prefix + diff size) into a
// semver bump + changelog badge, bumps package.json's version, and prepends
// an entry to content/changelog.json. The workflow step does the actual git
// commit/tag/push — this script is a pure read-files/write-files transform,
// safe to dry-run locally against any commit.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(fileURLToPath(import.meta.url), "..", "..");
const packageJsonPath = path.join(repoRoot, "package.json");
const changelogPath = path.join(repoRoot, "content", "changelog.json");

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function classify(subject, { insertions, deletions }) {
  const conventional = /^([a-zA-Z]+)(\([^)]*\))?(!)?:\s*(.*)$/.exec(subject);
  const type = conventional?.[1]?.toLowerCase() ?? "";
  const breaking = conventional?.[3] === "!";
  const rawTitle = conventional?.[4] ?? subject;
  const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);

  if (breaking) {
    return { bump: "major", badge: "New", title };
  }
  if (type === "fix") {
    return { bump: "patch", badge: "Fixed", title };
  }
  if (type === "refactor" || /\b(enhance|improve)\b/i.test(subject)) {
    return { bump: "patch", badge: "Changed", title };
  }
  // Default (incl. "feat" and anything unlabeled): treat as a shipped feature,
  // unless it's a tiny change that's clearly just polish.
  const isSmall = insertions + deletions < 150;
  return { bump: isSmall ? "patch" : "minor", badge: isSmall ? "Changed" : "New", title };
}

function bumpVersion(current, bump) {
  const [major, minor, patch] = current.split(".").map(Number);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function main() {
  const subject = git(["log", "-1", "--format=%s"]);
  const shortSha = git(["log", "-1", "--format=%h"]);
  const shortstat = git(["show", "--shortstat", "--format=", "HEAD"]);
  const insertions = Number(/(\d+) insertion/.exec(shortstat)?.[1] ?? 0);
  const deletions = Number(/(\d+) deletion/.exec(shortstat)?.[1] ?? 0);

  const { bump, badge, title } = classify(subject, { insertions, deletions });

  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const nextVersion = bumpVersion(pkg.version, bump);
  pkg.version = nextVersion;
  writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);

  const changelog = JSON.parse(readFileSync(changelogPath, "utf8"));
  changelog.unshift({
    version: nextVersion,
    date: new Date().toISOString().slice(0, 10),
    badge,
    title,
    commit: shortSha,
  });
  writeFileSync(changelogPath, `${JSON.stringify(changelog, null, 2)}\n`);

  // Consumed by the workflow step to write the commit message and tag name.
  console.log(nextVersion);
}

main();
