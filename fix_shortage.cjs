const fs = require('fs');
let code = fs.readFileSync('src/components/ShortageManager.tsx', 'utf8');

const regex = /\/\* Creator Info \*\/[\s\S]*?(?=<div className="flex items-center gap-1.5 text-neutral-800 font-bold mr-1">)/;

const newCode = `                    {/* Creator Info */}
                    {item.createdBy && (
                      <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded mr-1" title="Người tạo phiếu">
                        <UserCircle className="w-3 h-3 text-indigo-500" />
                        <span className="font-medium">Tạo bởi: {item.createdBy}</span>
                      </div>
                    )}
                    {/* Customer name & phone */}
                    `;

code = code.replace(regex, newCode);
fs.writeFileSync('src/components/ShortageManager.tsx', code);
