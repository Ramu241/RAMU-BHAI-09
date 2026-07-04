const fs = require('fs');
const vm = require('vm');

const unescaped = fs.readFileSync('step1_clean.js', 'utf8');

console.log("Compiling unescaped code of length:", unescaped.length);

try {
    new vm.Script(unescaped);
    console.log("Successfully compiled unescaped code! No syntax errors!");
} catch (e) {
    console.error("Compilation error in unescaped code:");
    console.error(e.message);
    if (e.stack) {
        console.error(e.stack);
    }
}
