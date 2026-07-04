const fs = require('fs');

// Read step1 code
const code = fs.readFileSync('step1.txt', 'utf8');

// Find the start of the self-executing function: (_L55c0Y=>"return
const startWord = '(_L55c0Y=>"return';
const startIndex = code.indexOf(startWord);

if (startIndex === -1) {
    console.error("Could not find start of self-executing function!");
    process.exit(1);
}

// Find _L55c0Y._Y1j23 which comes right after the self-executing function
const endMarker = '_L55c0Y._Y1j23';
const markerIndex = code.indexOf(endMarker, startIndex);

if (markerIndex === -1) {
    console.error("Could not find endMarker in step1.txt!");
    process.exit(1);
}

// Find the last closing parenthesis and semicolon before the marker
const lastSemiIndex = code.lastIndexOf(';', markerIndex);
if (lastSemiIndex === -1 || lastSemiIndex < startIndex) {
    console.error("Could not find semicolon before marker!");
    process.exit(1);
}

const selfExecutingFunc = code.substring(startIndex, lastSemiIndex + 1);
console.log("Extracted self-executing function length:", selfExecutingFunc.length);
console.log("Start snippet:", selfExecutingFunc.substring(0, 100));
console.log("End snippet:", selfExecutingFunc.substring(selfExecutingFunc.length - 100));

// Setup browser environment mocks
global.window = global;
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.document = {
    characterSet: 'UTF-8',
    addEventListener: () => {},
    removeEventListener: () => {}
};

// We will capture _L55c0Y inside the execution
global._L55c0Y = {};

// We override Function constructor so that the internal constructor calls during decryption work
const originalFunction = global.Function;
global.Function = function(...args) {
    return originalFunction(...args);
};
Object.defineProperty(global.Function.prototype, 'constructor', {
    value: global.Function,
    writable: true,
    configurable: true
});

try {
    // Evaluate the self-executing function to populate global._L55c0Y
    const evalFunc = new Function('_L55c0Y', `return (${selfExecutingFunc})`);
    const populatedL = evalFunc(global._L55c0Y);
    
    // In case it returned _L55c0Y, or we check the global object
    const targetL = populatedL || global._L55c0Y;
    
    console.log("Self-executing function ran successfully!");
    console.log("Check if _Y1j23 is defined:", typeof targetL._Y1j23);
    
    if (typeof targetL._Y1j23 === 'function') {
        const decryptedPayload = targetL._Y1j23();
        console.log("Successfully decrypted payload! Length:", decryptedPayload.length);
        
        // Split by zero-width space and join with semicolon + newline
        const statements = decryptedPayload.split('\u200b');
        console.log("Number of statements in decrypted payload:", statements.length);
        
        const cleanCode = statements.join(';\n');
        fs.writeFileSync('decrypted_payload.js', cleanCode, 'utf8');
        console.log("Wrote fully decrypted payload to decrypted_payload.js!");
    } else {
        console.error("targetL._Y1j23 is not a function!", targetL);
    }
} catch (e) {
    console.error("Error executing self-executing function:", e);
}
