const fs = require('fs');

// Browser Mocks
global.window = global;
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.document = {
    characterSet: 'UTF-8',
    addEventListener: () => {},
    removeEventListener: () => {}
};

// We intercept the global Function constructor to see what gets evaluated
const originalFunction = global.Function;
let callCount = 1; // Since step1 is already call 1, next is call 2

global.Function = function(...args) {
    callCount++;
    const code = args[args.length - 1];
    const filename = `step${callCount}.txt`;
    fs.writeFileSync(filename, code);
    console.log(`Captured call ${callCount} in ${filename}! Length:`, code.length);
    
    // Create a function using original constructor
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

// Also let's capture any constructed function using the new Function(...) syntax
Object.defineProperty(global.Function.prototype, 'constructor', {
    value: global.Function,
    writable: true,
    configurable: true
});

// Read the pristine step1 code
let code = fs.readFileSync('step1.txt', 'utf8');

// We replace the syntax-error / parentheses-error part of the code
const target = '_WZWjLh7l2(2)]("_L55c0Y",_Izgl5ltm)(_L55c0Y))!==false;}))';
const replacement = '((_WZWjLh7l2(2)]("_L55c0Y",_Izgl5ltm)(_L55c0Y))!==false);}'; // wait! Let's use the exact clean one:
// Let's replace '((_WZWjLh7l2(2)]("_L55c0Y",_Izgl5ltm)(_L55c0Y))!==false;}))' with:
// '(((()=>{})[_WZWjLh7l2(2)]("_L55c0Y",_Izgl5ltm)(_L55c0Y))!==false);}))'

const targetCode = '((_WZWjLh7l2(2)]("_L55c0Y",_Izgl5ltm)(_L55c0Y))!==false;}))';
const replacementCode = '(((()=>{})[_WZWjLh7l2(2)]("_L55c0Y",_Izgl5ltm)(_L55c0Y))!==false);}))';

if (code.includes(targetCode)) {
    code = code.replace(targetCode, replacementCode);
    console.log("Found and replaced targetCode in step1!");
} else {
    console.log("Could not find targetCode in step1. Let's try matching with double quotes if any.");
}

// Let's execute the repaired step1 code!
console.log("Executing repaired step1...");
try {
    const fn = originalFunction(code);
    fn();
} catch (e) {
    console.error("Error executing step1:", e);
}
