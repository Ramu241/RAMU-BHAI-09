const fs = require('fs');

// Read step1 code
const code = fs.readFileSync('step1.txt', 'utf8');

// Character-by-character unescaper
let unescaped = '';
let i = 0;
while (i < code.length) {
    const char = code[i];
    if (char === '\\') {
        const nextChar = code[i + 1];
        if (nextChar === '"') {
            unescaped += '"';
            i += 2;
        } else if (nextChar === '\\') {
            unescaped += '\\';
            i += 2;
        } else if (nextChar === 'n') {
            unescaped += '\n';
            i += 2;
        } else if (nextChar === 't') {
            unescaped += '\t';
            i += 2;
        } else {
            unescaped += '\\';
            i += 1;
        }
    } else {
        unescaped += char;
        i += 1;
    }
}

console.log("Original step1.txt length:", code.length);
console.log("Unescaped code length:", unescaped.length);

// Write to a temporary clean file
fs.writeFileSync('step1_clean.js', unescaped, 'utf8');
console.log("Wrote unescaped code to step1_clean.js!");

// Now let's try to run step1_clean.js with our mock environment and Function interceptor!
console.log("Executing step1_clean.js directly...");

global.window = global;
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.document = {
    characterSet: 'UTF-8',
    addEventListener: () => {},
    removeEventListener: () => {}
};

const originalFunction = global.Function;
let callCount = 1; // step1 is call 1, next is call 2

global.Function = function(...args) {
    callCount++;
    const code = args[args.length - 1];
    const filename = `step${callCount}.txt`;
    fs.writeFileSync(filename, code);
    console.log(`Captured call ${callCount} in ${filename}! Length:`, code.length);
    
    const fn = originalFunction(...args);
    return function(...callArgs) {
        console.log(`Executing captured function ${callCount}...`);
        try {
            return fn.apply(this, callArgs);
        } catch (e) {
            console.error(`Error running captured function ${callCount}:`, e);
        }
    };
};

Object.defineProperty(global.Function.prototype, 'constructor', {
    value: global.Function,
    writable: true,
    configurable: true
});

try {
    const fn = originalFunction(unescaped);
    fn();
    console.log("step1_clean.js executed successfully!");
} catch (e) {
    console.error("Error executing step1_clean.js:", e);
}
