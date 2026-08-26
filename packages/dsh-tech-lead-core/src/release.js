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
  if (input === null || typeof input !== 'object' || !Array.isArray(input.files)) {
    return [{ type: 'BAD_INPUT', path: '', line: 0, detail: 'releaseAudit expects {allowlist[], files[]}' }];
  }
  const allowlist = new Set(input.allowlist ?? []);
  const contentScan = input.contentScan !== false;

  for (const file of input.files) {
    if (file === null || typeof file !== 'object' || typeof file.path !== 'string') {
      v.push({ type: 'BAD_ENTRY', path: '', line: 0, detail: 'files[] entries must be objects with a path' });
      continue;
    }
    if (!allowlist.has(file.path)) {
      v.push({ type: 'EXTRA_FILE', path: file.path, line: 0, detail: 'not in release allowlist' });
    }
    if (!contentScan) continue;
    if (typeof file.content !== 'string') {
      v.push({ type: 'UNSCANNED', path: file.path, line: 0, detail: 'no content provided; file was NOT leak-scanned' });
      continue;
    }

    const lines = file.content.split('\n');
    lines.forEach((line, idx) => {
      // Detectors are independent: one line can legitimately carry several leak classes.
      if (ABS_PATH_RE.test(line)) {
        push(v, 'ABS_PATH', file.path, idx + 1, 'absolute home/user path');
      }
      const tok = line.match(TOKEN_RE);
      if (tok) push(v, 'TOKEN_SUSPECT', file.path, idx + 1, `token-like literal (${tok[0].slice(0, 6)}…)`);
      const cred = line.match(CRED_LINE_RE);
      if (cred) push(v, 'CREDENTIAL_LINE', file.path, idx + 1, 'credential assignment');
    });
  }
  return v;
}

const ABS_PATH_RE =
  /(\/data\/data\/com\.termux|\/Users\/[A-Za-z0-9_.-]+|\/home\/[A-Za-z0-9_.-]+|\/root(?:\/[^\s'"]*)?|C:\\+Users\\+[A-Za-z0-9_.-]+)/i;
const TOKEN_RE = /\b(sk-[A-Za-z0-9][A-Za-z0-9-]{7,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|AIza[A-Za-z0-9_-]{10,}|xox[baprs]-[A-Za-z0-9-]{10,})/;
const CRED_LINE_RE = /\b(bearer\s+[A-Za-z0-9._-]{10,}|(password|passwd|pwd|secret|api[_-]?key|token)\s*[=:]\s*['"]?[^\s'\"]{6,})/i;

function push(arr, type, path, line, detail) {
  arr.push({ type, path, line, detail });
}
