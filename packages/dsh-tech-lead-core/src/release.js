/**
 * Release audit (SKILL §11 INVENTORY/CONTENT-SCAN, mechanical subset).
 * Pure function: regex scan over provided content only — no filesystem access.
 *
 * @param {{
 *   allowlist: string[],
 *   files: Array<{path: string, content?: string}>,
 *   contentScan?: boolean,
 * }} input
 * @returns {Array<{type:string, path:string, line:number, detail:string}>}
 */
export function releaseAudit(input = {}) {
  /** @type {Array<{type:string, path:string, line:number, detail:string}>} */
  const v = [];
  const allowlist = new Set(input.allowlist ?? []);
  const contentScan = input.contentScan !== false;

  for (const file of input.files ?? []) {
    if (!allowlist.has(file.path)) {
      v.push({ type: 'EXTRA_FILE', path: file.path, line: 0, detail: 'not in release allowlist' });
    }
    if (!contentScan || typeof file.content !== 'string') continue;

    const lines = file.content.split('\n');
    lines.forEach((line, idx) => {
      if (ABS_PATH_RE.test(line)) {
        push(v, 'ABS_PATH', file.path, idx + 1, 'absolute home/user path');
      } else {
        const tok = line.match(TOKEN_RE);
        if (tok) push(v, 'TOKEN_SUSPECT', file.path, idx + 1, `token-like literal (${tok[0].slice(0, 6)}…)`);
        const cred = line.match(CRED_LINE_RE);
        if (cred) push(v, 'CREDENTIAL_LINE', file.path, idx + 1, 'credential assignment');
      }
    });
  }
  return v;
}

const ABS_PATH_RE =
  /(\/data\/data\/com\.termux|\/Users\/[A-Za-z0-9_.-]+|\/home\/[A-Za-z0-9_.-]+|C:\\+Users\\\\[A-Za-z0-9_.-]+)/i;
const TOKEN_RE = /\b(sk-[A-Za-z0-9]{8,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/;
const CRED_LINE_RE = /\b(bearer\s+[A-Za-z0-9._-]{10,}|(password|passwd|secret|api[_-]?key|token)\s*[=:]\s*['\"]?[^\s'\"]{6,})\b/i;

function push(arr, type, path, line, detail) {
  arr.push({ type, path, line, detail });
}
