import { readFileSync } from 'node:fs';

function patchLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (text.endsWith('\n')) lines.pop();
  return lines.map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l));
}
function blank(s: string): boolean { return s.trim() === ''; }

class Exit2 { readonly line: string; constructor(line: string) { this.line = line; } }

function safe(p: string): boolean { return p !== '' && !p.startsWith('/') && !p.includes('\\') && p.split('/').every((s) => s !== '' && s !== '.' && s !== '..'); }
function tierKey(line: string, tier: number): string { if (tier === 0) return line; if (tier === 1) return line.replace(/[ \t]+$/, ''); return line.trim(); }
function findMatch(fileLines: string[], oldLines: string[], tier: number): number[] { if (oldLines.length === 0) return []; const keys = oldLines.map(l => tierKey(l, tier)); const matches: number[] = []; for (let i = 0; i <= fileLines.length - oldLines.length; i++) { let ok = true; for (let j = 0; j < oldLines.length; j++) { if (tierKey(fileLines[i + j], tier) !== keys[j]) { ok = false; break; } } if (ok) matches.push(i); } return matches; }
function applyMatch(fileLines: string[], oldLines: string[], newLines: string[], matchIdx: number, tier: number): string[] { const oldKey = tierKey(oldLines[0], tier); let F = ''; let P = ''; if (tier === 2) { const fLine = fileLines[matchIdx]; const pLine = oldLines[0]; F = fLine.match(/^[ \t]*/)?.[0] ?? ''; P = pLine.match(/^[ \t]*/)?.[0] ?? ''; } const out: string[] = []; for (let i = 0; i < fileLines.length; i++) { if (i === matchIdx) { for (const nl of newLines) { if (tier === 2 && nl !== '' && !/^[ \t]*$/.test(nl) && nl.startsWith(P)) { out.push(F + nl.slice(P.length)); } else { out.push(nl); } } i += oldLines.length - 1; } else { out.push(fileLines[i]); } } return out; }

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
    if (l === '*** End Patch') { i++; break; }
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
        if (blank(lines[i])) { i++; continue; }
        if (lines[i] === '*** End Patch') break;
        if (lines[i].startsWith('*** ')) break;
        const chunk: V4AChunk = { anchor: '', body: [], endOfFile: false };
        if (lines[i].startsWith('@@')) { chunk.anchor = lines[i].slice(2).trim(); console.log('anchor:', chunk.anchor); i++; }
        while (i <= lastIdx) {
          const bl = lines[i];
          console.log('  chunk body i=', i, 'bl=', JSON.stringify(bl));
          if (bl === '*** End of File') { chunk.endOfFile = true; i++; break; }
          if (bl === '*** End Patch') break;
          if (bl.startsWith('*** ')) break;
          if (/^[ \-\+]/.test(bl) || bl === '') { chunk.body.push(bl); console.log('  body push:', bl); }
          else { console.log('ERROR parse at i=', i, bl); throw new Exit2('error: parse ' + (i + 1)); }
          i++;
        }
        chunks.push(chunk);
        if (i <= lastIdx && lines[i] === '*** End Patch') break;
      }
      if (i <= lastIdx && lines[i] === '*** End Patch') { i++; break; }
      sections.push({ type: 'update', path, moveTo, chunks });
    } else { throw new Exit2('error: parse ' + (i + 1)); }
  }
  return sections;
}

const data = JSON.parse(readFileSync('./hidden-spec-cli-01-run-20261122-kit/program/generator/practice.json', 'utf8'));
const c = data.checks.find(c => c.key === '86c8e4c8cbdbc96a7e5f71e927ba20bb48b38851e704b81019118726df8c51d7');
const patchText = c.files['change.diff'];

const lines = patchLines(patchText);

try {
  const sections = parseV4A(lines);
  console.log('Sections:', JSON.stringify(sections, null, 2));
} catch (e) {
  console.log('Error:', e.line);
}