const fs = require('fs');

// Read the clean version from disk
let code = fs.readFileSync('run_deob.cjs', 'utf8');

// 1. Put the zero-width spaces back exactly where they belong using split/join
// - After the semicolon before _L55c0Y._Y1j23
// - Inside the split template backticks
code = code.split('\\\");_L55c0Y').join('\\\");\u200b_L55c0Y');
code = code.split('(\`\`)').join('(\`\u200b\`)');

console.log("Restored zero-width spaces in memory!");

// 2. Apply the correct syntax parenthesis fix
// We want to replace '((_WZWjLh7l2(2)](\"_L55c0Y\",_Izgl5ltm)(_L55c0Y))!==false;}))'
// with '(((()=>{})[_WZWjLh7l2(2)](\"_L55c0Y\",_Izgl5ltm)(_L55c0Y))!==false);}))'
// Note that in run_deob.cjs, the quotes inside this statement are escaped as \" because it's inside a double quoted string.
const badSyntax = '((_WZWjLh7l2(2)](\\"_L55c0Y\\",_Izgl5ltm)(_L55c0Y))!==false;}))';
const goodSyntax = '(((()=>{})[_WZWjLh7l2(2)](\\"_L55c0Y\\",_Izgl5ltm)(_L55c0Y))!==false);}))';

if (code.includes(badSyntax)) {
    code = code.replace(badSyntax, goodSyntax);
    console.log("Successfully replaced bad syntax pattern in memory!");
} else {
    // In case the disk version has unescaped quotes or modified parenthesis
    const alternativeCorrect = '(((()=>{})[_WZWjLh7l2(2)](\\"_L55c0Y\\",_Izgl5ltm)(_L55c0Y))!==false);}))';
    if (code.includes(alternativeCorrect)) {
        console.log("Alternative correct pattern is already present in memory!");
    } else {
        console.log("Could not find syntax target in memory. Printing end of file to check state:");
        console.log(code.substring(code.length - 250));
    }
}

// 3. Write this to run_deob_final.cjs
fs.writeFileSync('run_deob_final.cjs', code, 'utf8');
console.log("Wrote fully repaired code to run_deob_final.cjs!");

// 4. Run it with our mock environment and Function hook
console.log("Running run_deob_final.cjs...");

global.window = global;
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.document = {
    characterSet: 'UTF-8',
    addEventListener: () => {},
    removeEventListener: () => {}
};

const originalFunction = global.Function;
let callCount = 0;

global.Function = function(...args) {
    callCount++;
    const codeStr = args[args.length - 1];
    
    // Save to step files
    const filename = `step${callCount}.txt`;
    fs.writeFileSync(filename, codeStr);
    console.log(`Captured call ${callCount} in ${filename}! Length:`, codeStr.length);
    
    const fn = originalFunction(...args);
    return function(...callArgs) {
        console.log(`Executing captured function ${callCount}...`);
        try {
            const result = fn.apply(this, callArgs);
            return result;
        } catch (e) {
            console.error(`Error executing captured function ${callCount}:`, e);
        }
    };
};

Object.defineProperty(global.Function.prototype, 'constructor', {
    value: global.Function,
    writable: true,
    configurable: true
});

try {
    require('./run_deob_final.cjs');
    console.log("Execution of run_deob_final.cjs completed successfully!");
} catch (e) {
    console.error("Execution error:", e);
}
