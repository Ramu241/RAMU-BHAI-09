const fs = require('fs');
const code = fs.readFileSync('step1.txt', 'utf8');

let inSingle = false;
let inDouble = false;
let inBacktick = false;
let escaped = false;

console.log("Tracing all double quote state transitions:");

for (let i = 0; i < code.length; i++) {
    const char = code[i];
    if (escaped) {
        escaped = false;
        continue;
    }
    if (char === '\\') {
        escaped = true;
        continue;
    }
    if (char === "'" && !inDouble && !inBacktick) {
        inSingle = !inSingle;
    } else if (char === '"' && !inSingle && !inBacktick) {
        inDouble = !inDouble;
        const stateStr = inDouble ? "ENTER (true)" : "EXIT (false)";
        console.log(`Index ${i}: ${stateStr} | Context: ${code.substring(Math.max(0, i - 30), Math.min(code.length, i + 30)).replace(/\n/g, '\\n')}`);
    } else if (char === '`' && !inSingle && !inDouble) {
        inBacktick = !inBacktick;
    }
}

console.log("Final balance status:", inDouble);
