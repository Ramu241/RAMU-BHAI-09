const fs = require('fs');
const code = fs.readFileSync('step1.txt', 'utf8');

// Simple parser to find unclosed quotes
let inSingle = false;
let inDouble = false;
let inBacktick = false;
let escaped = false;

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
    } else if (char === '`' && !inSingle && !inDouble) {
        inBacktick = !inBacktick;
    }
}

console.log("Quotes balance status:");
console.log("In Single Quote:", inSingle);
console.log("In Double Quote:", inDouble);
console.log("In Backtick:", inBacktick);
