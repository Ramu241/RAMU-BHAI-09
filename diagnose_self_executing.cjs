const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('step1.txt', 'utf8');

const startWord = '(_L55c0Y=>"return';
const startIndex = code.indexOf(startWord);

const endMarker = '_L55c0Y._Y1j23';
const markerIndex = code.indexOf(endMarker, startIndex);

const lastSemiIndex = code.lastIndexOf(';', markerIndex);
const selfExecutingFunc = code.substring(startIndex, lastSemiIndex + 1);

console.log("Compiling selfExecutingFunc of length:", selfExecutingFunc.length);

try {
    new vm.Script(selfExecutingFunc);
    console.log("Successfully compiled selfExecutingFunc! No syntax errors!");
} catch (e) {
    console.error("Compilation error in selfExecutingFunc:");
    console.error(e.message);
    if (e.stack) {
        console.error(e.stack);
    }
}
