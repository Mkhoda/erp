import { Injectable } from '@nestjs/common';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Reads the running app's version/commit history straight from the git
// checkout on disk — production is a plain `git pull` deploy (no build-time
// version stamping), so git itself is the only reliable source of "what
// version is this". `git` auto-discovers the enclosing repo from cwd, so
// this works whether the process cwd is the repo root (prod, pm2) or
// apps/backend (dev, ts-node-dev).
@Injectable()
export class SystemInfoService {
  private git(args: string[]): string {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).trim();
  }

  private packageVersion(): string {
    try {
      const root = this.git(['rev-parse', '--show-toplevel']);
      const pkg = JSON.parse(fs.readFileSync(path.join(root, 'apps', 'backend', 'package.json'), 'utf8'));
      return pkg.version || '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  getVersion() {
    try {
      const commitHash = this.git(['rev-parse', 'HEAD']);
      const commitShort = this.git(['rev-parse', '--short', 'HEAD']);
      const branch = this.git(['rev-parse', '--abbrev-ref', 'HEAD']);
      const commitMessage = this.git(['log', '-1', '--format=%s']);
      const commitAuthor = this.git(['log', '-1', '--format=%an']);
      const commitDate = this.git(['log', '-1', '--format=%cI']);
      const commitCount = this.git(['rev-list', '--count', 'HEAD']);
      const pkgVersion = this.packageVersion();
      return {
        version: `${pkgVersion}+${commitCount}`,
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
      const out = this.git(['log', `-n${n}`, `--format=%H${SEP}%h${SEP}%s${SEP}%an${SEP}%cI`]);
      if (!out) return [];
      return out.split('\n').map((line) => {
        const [hash, shortHash, message, author, date] = line.split(SEP);
        return { hash, shortHash, message, author, date };
      });
    } catch {
      return [];
    }
  }
}
