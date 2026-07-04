const fs = require('fs');

// Read run_deob.cjs code
let code = fs.readFileSync('run_deob.cjs', 'utf8');

// Replace all zero-width spaces (u200b) with empty string
const initialLength = code.length;
code = code.replace(/\u200b/g, '');
const finalLength = code.length;

console.log(`Removed ${initialLength - finalLength} zero-width space characters from run_deob.cjs!`);

// Let's write the cleaned code back
fs.writeFileSync('run_deob.cjs', code, 'utf8');
