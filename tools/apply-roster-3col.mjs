// One-shot: rewrite the roster card into three columns (identity / specs / portrait),
// matching the marketplace layout. Keeps the venue selector and Transfer/Release button.
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "E:/emporium/app/src/App.tsx";
let src = readFileSync(FILE, "utf8");

const NEW_BODY = `                  <div key={char.id} className="bg-slate-900 border-slate-800 rounded-xl overflow-hidden shadow-xl group text-left">
                    {/* Three columns: identity / characteristics / portrait */}
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_10rem] divide-x divide-slate-800">

                      {/* COLUMN 1 - name, role, region, assignment, resale */}
                      <div className="p-4 flex-col justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-white text leading-tight">{char.name}</h3>
                          <p className="text-amber-400 font-medium text-xs mt-1">{char.role}</p>
                          <p className="text-slate-400 text-xs mt-0.5">{char.regionName}</p>
                          <span className="inline-block mt-2 text-xs font-mono uppercase bg-slate-950 px-2 py-0.5 rounded border-slate-800 text-slate-400">{char.gender}</span>
                        </div>

                        {/* Venue Assignment Selector */}
                        <div>
                          <label className="block text-[10px] uppercase text-slate-400 font-semibold mb-1">Work Assignment Venue</label>
                          <select
                            value={char.assignedVenue || 'trade'}
                            onChange={(e) => assignVenue(char.id, e.target.value as any)}
                            className="w-full bg-slate-950 border-slate-800 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-pink-500 font-mono"
                          >
                            <option value="trade">Trade Network & Logistics</option>
                            <option value="beauty_salon">Beauty Salon</option>
                            <option value="strip_club">Strip Club</option>
                            <option value="pleasure_house">Pleasure House</option>
                          </select>
                        </div>

                        <div className="border-t border-slate-800/60 pt-3">
                          <div className="text-[10px] uppercase text-slate-500 font-semibold">Resale Value</div>
                          <div className="text-base font-bold font-mono text-emerald-400 leading-tight">\${Math.floor(char.price * 0.75).toLocaleString()}</div>
                        </div>
                      </div>

                      {/* COLUMN 2 - characteristics */}
                      <div className="p-4 space-y-2 text-xs font-mono">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Attractiveness</span>
                          <span className="text-emerald-400 font-bold">{attr} / 100</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Health</span>
                          <span className="text-emerald-400 font-bold">{isCEO ? \`\${char.exactHealth}% (\${char.healthLevel})\` : char.healthLevel}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Exhaustion</span>
                          <span className="text-amber-400 font-bold">{isCEO ? \`\${char.exactExhaustion}% (\${char.exhaustionLevel})\` : char.exhaustionLevel}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Loyalty</span>
                          <span className="text-purple-400 font-bold">{char.loyalty}%</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Skill Level</span>
                          <span className="text-emerald-400 font-bold">{char.skill} / 100</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Weekly Salary</span>
                          <span className="text-rose-400 font-bold">-\${char.salary}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Hair</span>
                          <span className="text-slate-300 text-right">{char.headHairStyle} ({char.headHairLength}cm)</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Pubic Hair</span>
                          <span className="text-slate-300">{char.pubicHairStyle}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Skin</span>
                          <span className="text-pink-400">{char.skinCondition}</span>
                        </div>
                      </div>

                      {/* COLUMN 3 - portrait */}
                      <div
                        className="relative bg-slate-950 cursor-pointer min-h-[15rem]"
                        onClick={() => setFullscreenImage(char.image)}
                        title="Click to view full size"
                      >
                        <img src={char.image} alt={char.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                          <Maximize2 className="w-8 h-8 text-white" />
                        </div>
                        <div className="absolute top-3 right-3 bg-emerald-500/25 backdrop-blur border-emerald-500/40 px-3 py-1 rounded-full text-xs font-mono text-emerald-300">
                          Attr: {attr}/100
                        </div>
                      </div>
                    </div>

                    {/* Action bar */}
                    <div className="px-4 py-3 border-t border-slate-800/60 flex items-center justify-between gap-4">
                      <span className="text-[10px] uppercase text-slate-500 font-semibold">
                        {char.assignedVenue ? char.assignedVenue.replace('_', ' ') : 'trade'}
                      </span>
                      <button
                        onClick={() => sellCharacter(char)}
                        className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30 px-4 py-2 rounded-lg font-bold text-xs transition cursor-pointer"
                      >
                        Transfer / Release
                      </button>
                    </div>
                  </div>`;

// Roster grid: 3 narrow columns -> 2 wider ones, same as the marketplace.
const GRID_OLD =
  '            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">\n              {gameState.roster.map(char => {';
const GRID_NEW =
  '            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">\n              {gameState.roster.map(char => {';
if (!src.includes(GRID_OLD)) throw new Error("roster grid line not found");
src = src.replace(GRID_OLD, GRID_NEW);

// Roster card opening tag.
const START_RE =
  /^ {18}<div key=\{char\.id\} className="bg-slate-900[^"]*flex flex-col justify-between[^"]*">/m;
const startMatch = START_RE.exec(src);
if (!startMatch) throw new Error("roster card start marker not found");
const startIdx = startMatch.index;

// Card ends with the Transfer / Release button and its closing divs.
const END_MARK = `                        Transfer / Release
                      </button>
                    </div>
                  </div>`;
const endRel = src.indexOf(END_MARK, startIdx);
if (endRel === -1) throw new Error("roster card end marker not found");
const endIdx = endRel + END_MARK.length;

const slice = src.slice(startIdx, endIdx);
if (!slice.includes("assignVenue"))
  throw new Error("slice looks wrong (venue selector missing)");

src = src.slice(0, startIdx) + NEW_BODY + src.slice(endIdx);
writeFileSync(FILE, src, "utf8");

console.log("OK: roster card rewritten into 3 columns");
console.log("removed chars:", endIdx - startIdx);
console.log("inserted chars:", NEW_BODY.length);
