import { readFileSync } from 'node:fs';

function patchLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (text.endsWith('\n')) lines.pop();
  return lines.map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l));
}
function blank(s: string): boolean { return s.trim() === ''; }

class Exit2 { readonly line: string; constructor(line: string) { this.line = line; } }
class Fail { readonly code: string; readonly path: string; constructor(code: string, path: string) { this.code = code; this.path = path; } }

function safe(p: string): boolean { return p !== '' && !p.startsWith('/') && !p.includes('\\') && p.split('/').every((s) => s !== '' && s !== '.' && s !== '..'); }
function tierKey(line: string, tier: number): string { if (tier === 0) return line; if (tier === 1) return line.replace(/[ \t]+$/, ''); return line.trim(); }
function findMatch(fileLines: string[], oldLines: string[], tier: number): number[] { if (oldLines.length === 0) return []; const keys = oldLines.map(l => tierKey(l, tier)); const matches: number[] = []; for (let i = 0; i <= fileLines.length - oldLines.length; i++) { let ok = true; for (let j = 0; j < oldLines.length; j++) { if (tierKey(fileLines[i + j], tier) !== keys[j]) { ok = false; break; } } if (ok) matches.push(i); } return matches; }

interface V4AChunk { anchor: string; body: string[]; endOfFile: boolean }
interface V4ASection { type: 'add' | 'delete' | 'update'; path: string; moveTo?: string; lines?: string[]; chunks?: V4AChunk[] }

function parseV4A(lines: string[]): V4ASection[] {
  const firstNonBlank = lines.findIndex(l => !blank(l));
  console.log('firstNonBlank:', firstNonBlank, lines[firstNonBlank]);
  if (firstNonBlank < 0 || lines[firstNonBlank].trim() !== '*** Begin Patch') throw new Exit2('error: parse 1');
  const lastNonBlank = [...lines].reverse().findIndex(l => !blank(l));
  const lastIdx = lines.length - 1 - lastNonBlank;
  console.log('lastIdx:', lastIdx, lines[lastIdx]);
  if (lastIdx < 0 || lines[lastIdx].trim() !== '*** End Patch') throw new Exit2('error: parse ' + (lines.length + 1));
  
  const sections: V4ASection[] = [];
  let i = firstNonBlank + 1;
  while (i <= lastIdx) {
    const l = lines[i];
    console.log('i=', i, 'l=', JSON.stringify(l));
    if (blank(l)) { i++; continue; }
    if (l.startsWith('*** Add File: ')) { throw new Exit2('not implemented'); }
    else if (l.startsWith('*** Delete File: ')) { throw new Exit2('not implemented'); }
    else if (l.startsWith('*** Update File: ')) {
      const path = l.slice(17).trim();
      console.log('Update File path:', path);
      if (!safe(path)) throw new Exit2('error: parse ' + (i + 1));
      i++;
      let moveTo: string | undefined;
      if (i <= lastIdx && lines[i].startsWith('*** Move to: ')) { moveTo = lines[i].slice(13).trim(); i++; }
      const chunks: V4AChunk[] = [];
      while (i <= lastIdx) {
        if (blank(lines[i])) { console.log('blank at', i); i++; continue; }
        if (lines[i].startsWith('*** ')) { console.log('break on *** at i=', i, lines[i]); break; }
        const chunk: V4AChunk = { anchor: '', body: [], endOfFile: false };
        if (lines[i].startsWith('@@')) { chunk.anchor = lines[i].slice(2).trim(); console.log('anchor:', chunk.anchor); i++; }
        while (i <= lastIdx) {
          const bl = lines[i];
          console.log('  chunk body i=', i, 'bl=', JSON.stringify(bl));
          if (bl === '*** End of File') { chunk.endOfFile = true; i++; break; }
          if (bl.startsWith('*** ')) { console.log('break on *** at i=', i, bl); break; }
          if (/^[ \-\+]/.test(bl) || bl === '') { chunk.body.push(bl); console.log('  body push:', bl); }
          else { console.log('ERROR parse at i=', i, bl); throw new Exit2('error: parse ' + (i + 1)); }
          i++;
        }
        chunks.push(chunk);
      }
      console.log('chunks:', JSON.stringify(chunks, null, 2));
      sections.push({ type: 'update', path, moveTo, chunks });
    } else { throw new Exit2('error: parse ' + (i + 1)); }
  }
  return sections;
}

const patchText = `*** Begin Patch
*** Update File: web/payload/header.go
 func SaveMetric(limit []int) int {
 	total := len(limit) + 94
 	if total > 448 {
-		return total / 4
+		signal total / 4
+		// split the graph vendor
 	}
 	return total * 6
 }
*** End Patch`;

const lines = patchLines(patchText);

try {
  const sections = parseV4A(lines);
  console.log('Sections:', JSON.stringify(sections, null, 2));
} catch (e) {
  console.log('Error:', e.line);
}