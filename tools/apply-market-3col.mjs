// One-shot: rewrite the marketplace card into three columns (identity / specs / portrait).
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = 'E:/emporium/app/src/App.tsx'
let src = readFileSync(FILE, 'utf8')

const NEW_BODY = `                <div key={char.id} className="bg-slate-900 border-slate-800 rounded-xl overflow-hidden shadow-xl group hover:border-amber-500/50 transition text-left">
                  {/* Three columns: identity / characteristics / portrait */}
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_10rem] divide-x divide-slate-800">

                    {/* COLUMN 1 - name, role, gender, price */}
                    <div className="p-4 flex-col justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-white text-base leading-tight">{char.name}</h3>
                        <p className="text-amber-400 font-medium text-xs mt-1">{char.role}</p>
                        <span className="inline-block mt-2 text-xs font-mono uppercase bg-slate-950 px-2 py-0.5 rounded border-slate-800 text-slate-400">{char.gender}</span>
                      </div>
                      <div className="border-t border-slate-800/60 pt-3">
                        <div className="text-[10px] uppercase text-slate-500 font-semibold">Acquisition Price</div>
                        <div className="text-xl font-bold font-mono text-amber-400 leading-tight">\${char.price.toLocaleString()}</div>
                      </div>
                    </div>

                    {/* COLUMN 2 - characteristics */}
                    <div className="p-4 space-y-2 text-xs font-mono">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Region</span>
                        <span className="text-slate-300 text-right">{char.regionName}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Skill Level</span>
                        <span className="text-emerald-400 font-bold">{char.skill} / 100</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Attractiveness</span>
                        <span className="text-pink-400 font-bold">{calculateAttractiveness(char)} / 100</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Weekly Salary</span>
                        <span className="text-slate-200 font-bold">\${char.salary}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Loyalty</span>
                        <span className="text-purple-400">{char.loyalty}%</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Health</span>
                        <span className="text-sky-400">{char.healthLevel}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Skin</span>
                        <span className="text-slate-300">{char.skinCondition}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Hair</span>
                        <span className="text-slate-300 text-right">{char.headHairStyle} • {char.headHairLength} cm</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Tan</span>
                        <span className="text-slate-300">{char.tanningLevel}%</span>
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
                    </div>
                  </div>

                  {/* Action bar */}
                  <div className="px-4 py-3 border-t border-slate-800/60 flex items-center justify-between gap-4">
                    <span className="text-[10px] uppercase text-slate-500 font-semibold">{char.regionName}</span>
                    <button
                      onClick={() => buyCharacter(char)}
                      disabled={gameState.funds < char.price}
                      className={\`px-4 py-2.5 rounded-lg font-bold text-sm transition \${
                        gameState.funds >= char.price
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer shadow-lg shadow-amber-500/20'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }\`}
                    >
                      Acquire Operative
                    </button>
                  </div>
                </div>`

const START_RE = /^ {16}<div key=.char\.id. className="bg-slate-900[^"]*flex-col justify-between[^"]*">/m;
const END_MARK = `                      Acquire Operative
                    </button>
                  </div>
                </div>`

const startMatch = START_RE.exec(src)
if (!startMatch) throw new Error('START marker (marketplace card) not found')
const startIdx = startMatch.index

// find the "Acquire Operative" button block that closes this card
const endRel = src.indexOf(END_MARK, startIdx)
if (endRel === -1) throw new Error('END marker (Acquire Operative) not found')

const endIdx = endRel + END_MARK.length
const before = src.slice(0, startIdx)
const after = src.slice(endIdx)

src = before + NEW_BODY + after
writeFileSync(FILE, src, 'utf8')

console.log('OK: replaced card markup')
console.log('removed chars:', endIdx - startIdx)
console.log('inserted chars:', NEW_BODY.length)
