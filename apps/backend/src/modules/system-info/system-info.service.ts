import { Injectable } from '@nestjs/common';
import { execFileSync } from 'child_process';

// Reads the running app's version/commit history straight from the git
// checkout on disk — production is a plain `git pull` deploy (no build-time
// version stamping), so git itself is the only reliable source of "what
// version is this". `git` auto-discovers the enclosing repo from cwd, so
// this works whether the process cwd is the repo root (prod, pm2) or
// apps/backend (dev, ts-node-dev).
//
// "Version" is a synthetic build number, not semver: major.minor.patch.build,
// derived from N = the commit's 0-based position in HEAD's history
// (git rev-list --count). It's a mixed-radix odometer, each segment rolling
// into the next once it fills up: build wraps every 16 (-> patch +1), patch
// wraps every 32 of its own ticks (-> minor +1, i.e. every 16*32=512 raw
// commits), minor wraps every 64 of its own ticks (-> major +1, i.e. every
// 16*32*64=32768 raw commits). Major starts at 1. This assumes a linear
// history (no merge commits) — true for this repo's workflow so far; a
// merge would make the per-row numbers in getCommits() approximate.
const BUILD_RADIX = 16;
const PATCH_RADIX = 32;
const MINOR_RADIX = 64;

@Injectable()
export class SystemInfoService {
  private git(args: string[]): string {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).trim();
  }

  private buildVersion(commitIndexFromHead: number, totalCount: number): string {
    const n = Math.max(0, totalCount - 1 - commitIndexFromHead);
    const build = n % BUILD_RADIX;
    const afterBuild = Math.floor(n / BUILD_RADIX);
    const patch = afterBuild % PATCH_RADIX;
    const afterPatch = Math.floor(afterBuild / PATCH_RADIX);
    const minor = afterPatch % MINOR_RADIX;
    const major = 1 + Math.floor(afterPatch / MINOR_RADIX);
    return `${major}.${minor}.${patch}.${build}`;
  }

  getVersion() {
    try {
      const commitHash = this.git(['rev-parse', 'HEAD']);
      const commitShort = this.git(['rev-parse', '--short', 'HEAD']);
      const branch = this.git(['rev-parse', '--abbrev-ref', 'HEAD']);
      const commitMessage = this.git(['log', '-1', '--format=%s']);
      const commitAuthor = this.git(['log', '-1', '--format=%an']);
      const commitDate = this.git(['log', '-1', '--format=%cI']);
      const totalCount = +this.git(['rev-list', '--count', 'HEAD']);
      return {
        version: this.buildVersion(0, totalCount),
        branch,
        commitHash,
        commitShort,
        commitMessage,
        commitAuthor,
        commitDate,
      };
    } catch {
      return {
        version: 'نامشخص',
        branch: null,
        commitHash: null,
        commitShort: null,
        commitMessage: null,
        commitAuthor: null,
        commitDate: null,
      };
    }
  }

  getCommits(limit = 50) {
    const n = Math.min(Math.max(Math.round(+limit) || 50, 1), 200);
    // Unit separator (\x1f) as the field delimiter — safe against commit
    // messages containing any normal punctuation, unlike "|" or ",".
    const SEP = '\x1f';
    try {
      const totalCount = +this.git(['rev-list', '--count', 'HEAD']);
      const out = this.git(['log', `-n${n}`, `--format=%H${SEP}%h${SEP}%s${SEP}%an${SEP}%cI`]);
      if (!out) return [];
      return out.split('\n').map((line, idx) => {
        const [hash, shortHash, message, author, date] = line.split(SEP);
        return { hash, shortHash, message, author, date, version: this.buildVersion(idx, totalCount) };
      });
    } catch {
      return [];
    }
  }
}
