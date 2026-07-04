const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('step1.txt', 'utf8');

try {
    new vm.Script(code);
    console.log("No syntax errors found! step1.txt compiles successfully!");
} catch (e) {
    console.error("Compilation error in step1.txt:");
    console.error(e.message);
    if (e.stack) {
        console.error(e.stack);
    }
}
