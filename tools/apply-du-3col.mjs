// One-shot: rewrite the "Дом удовольствия" (roster) tab list into a
// headerless three-column table (photo / info / venue+break+sell),
// and add the sellSlaveAtAuction handler after assignVenue.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'E:/emporium/app/src/App.tsx';
const HANDLER_FRAG = 'E:/emporium/app/tools/frag-du-3col-handler.txt';
const TABLE_FRAG = 'E:/emporium/app/tools/frag-du-3col-table.txt';

let src = readFileSync(FILE, 'utf8');
const handler = readFileSync(HANDLER_FRAG, 'utf8').replace(/\r?\n/g, '\r\n').trimEnd();
const table = readFileSync(TABLE_FRAG, 'utf8').replace(/\r?\n/g, '\r\n').trimEnd();

// 1) Insert sellSlaveAtAuction right after assignVenue's closing "};".
const anchorRe = /showNotify\(`Назначение обновлено: \$\{venueLabel\(venue\)\}\.`\);\r?\n  \};/;
const anchorMatch = anchorRe.exec(src);
if (!anchorMatch) throw new Error('assignVenue anchor not found');
const handlerInsertAt = anchorMatch.index + anchorMatch[0].length;
if (src.includes('sellSlaveAtAuction')) throw new Error('sellSlaveAtAuction already present');
src = src.slice(0, handlerInsertAt) + '\r\n' + handler + src.slice(handlerInsertAt);

// 2) Replace the roster card list with the headerless 3-column table.
const listStartRe = / {12}<div className="space-y-4">\r?\n {14}\{sortedRoster\.map\(char => \{/;
const listStartMatch = listStartRe.exec(src);
if (!listStartMatch) throw new Error('roster list start not found');

const dependentsRe = /<DependentsPanel dependents=\{gameState\.dependents \|\| \[\]\} \/>/;
const depMatch = dependentsRe.exec(src);
if (!depMatch) throw new Error('DependentsPanel marker not found');
if (depMatch.index < listStartMatch.index) throw new Error('marker order wrong');

src = src.slice(0, listStartMatch.index) + table + '\r\n' + src.slice(depMatch.index);

writeFileSync(FILE, src, 'utf8');
console.log('OK: DU tab rewritten as headerless 3-column table; sellSlaveAtAuction handler added');
