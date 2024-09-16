"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Allow = exports.MalformedJSON = exports.PartialJSON = exports.parse = void 0;
exports.parseJSON = parseJSON;
const options_1 = require("./options");
Object.defineProperty(exports, "Allow", { enumerable: true, get: function () { return options_1.Allow; } });
__exportStar(require("./options"), exports);
class PartialJSON extends Error {
}
exports.PartialJSON = PartialJSON;
class MalformedJSON extends Error {
}
exports.MalformedJSON = MalformedJSON;
/**
 * Parse incomplete JSON
 * @param {string} jsonString Partial JSON to be parsed
 * @param {number} allowPartial Specify what types are allowed to be partial, see {@link Allow} for details
 * @returns The parsed JSON
 * @throws {PartialJSON} If the JSON is incomplete (related to the `allow` parameter)
 * @throws {MalformedJSON} If the JSON is malformed
 */
function parseJSON(jsonString, allowPartial = options_1.Allow.ALL) {
    if (typeof jsonString !== "string") {
        throw new TypeError(`expecting string, got ${typeof jsonString}`);
    }
    if (!jsonString.trim()) {
        throw new Error(`Input is empty`);
    }
    return _parseJSON(jsonString.trim(), allowPartial);
}
const _parseJSON = (jsonString, allow) => {
    const length = jsonString.length;
    let index = 0;
    let objectDepth = 0; // Track the current depth of objects
    let arrayDepth = 0; // Track the current depth of arrays
    const markPartialJSON = (msg) => {
        throw new PartialJSON(`${msg} at position ${index}`);
    };
    const throwMalformedError = (msg) => {
        throw new MalformedJSON(`${msg} at position ${index}`);
    };
    const parseAny = () => {
        skipBlank();
        if (index >= length)
            markPartialJSON("Unexpected end of input");
        const currentChar = jsonString[index];
        // Handle string
        if (currentChar === '"')
            return parseStr();
        // Handle object
        if (currentChar === "{") {
            objectDepth++;
            const result = parseObj();
            objectDepth--;
            return result;
        }
        // Handle array
        if (currentChar === "[") {
            arrayDepth++;
            const result = parseArr();
            arrayDepth--;
            return result;
        }
        // Handle literals and numbers
        if (jsonString.substring(index, index + 4) === "null" ||
            (options_1.Allow.NULL & allow &&
                length - index < 4 &&
                "null".startsWith(jsonString.substring(index)))) {
            index += 4;
            return null;
        }
        if (jsonString.substring(index, index + 4) === "true" ||
            (options_1.Allow.BOOL & allow &&
                length - index < 4 &&
                "true".startsWith(jsonString.substring(index)))) {
            index += 4;
            return true;
        }
        if (jsonString.substring(index, index + 5) === "false" ||
            (options_1.Allow.BOOL & allow &&
                length - index < 5 &&
                "false".startsWith(jsonString.substring(index)))) {
            index += 5;
            return false;
        }
        if (jsonString.substring(index, index + 8) === "Infinity" ||
            (options_1.Allow.INFINITY & allow &&
                length - index < 8 &&
                "Infinity".startsWith(jsonString.substring(index)))) {
            index += 8;
            return Infinity;
        }
        if (jsonString.substring(index, index + 9) === "-Infinity" ||
            (options_1.Allow._INFINITY & allow &&
                1 < length - index &&
                length - index < 9 &&
                "-Infinity".startsWith(jsonString.substring(index)))) {
            index += 9;
            return -Infinity;
        }
        if (jsonString.substring(index, index + 3) === "NaN" ||
            (options_1.Allow.NAN & allow &&
                length - index < 3 &&
                "NaN".startsWith(jsonString.substring(index)))) {
            index += 3;
            return NaN;
        }
        return parseNum();
    };
    const parseStr = () => {
        const start = index;
        let escape = false;
        index++; // skip initial quote
        while (index < length) {
            const char = jsonString[index];
            if (char === '"' && !escape) {
                index++; // include the closing quote
                try {
                    return JSON.parse(jsonString.substring(start, index));
                }
                catch (e) {
                    throwMalformedError(`Invalid string: ${e}`);
                }
            }
            if (char === "\\" && !escape) {
                escape = true;
            }
            else {
                escape = false;
            }
            index++;
        }
        // If we reach here, the string was unterminated
        if (options_1.Allow.STR & allow) {
            try {
                // Attempt to close the string by adding the closing quote
                return JSON.parse(jsonString.substring(start, index) + '"');
            }
            catch (e) {
                // Attempt to recover by removing trailing backslashes
                const lastBackslash = jsonString.lastIndexOf("\\");
                if (lastBackslash > start) {
                    try {
                        return JSON.parse(jsonString.substring(start, lastBackslash) + '"');
                    }
                    catch (_) { }
                }
                throwMalformedError("Unterminated string literal");
            }
        }
        markPartialJSON("Unterminated string literal");
    };
    const parseObj = () => {
        const isOutermost = objectDepth === 1;
        index++; // skip initial brace
        skipBlank();
        const obj = {};
        try {
            while (jsonString[index] !== "}") {
                skipBlank();
                if (index >= length) {
                    if ((isOutermost && allow & options_1.Allow.OUTERMOST_OBJ) ||
                        allow & options_1.Allow.OBJ) {
                        return obj;
                    }
                    markPartialJSON("Unexpected end of object");
                }
                // Parse key
                const key = parseStr();
                skipBlank();
                if (jsonString[index] !== ":") {
                    throwMalformedError(`Expected ':' after key "${key}"`);
                }
                index++; // skip colon
                skipBlank();
                // Parse value
                try {
                    const value = parseAny();
                    obj[key] = value;
                }
                catch (e) {
                    if ((isOutermost && allow & options_1.Allow.OUTERMOST_OBJ) ||
                        allow & options_1.Allow.OBJ) {
                        return obj;
                    }
                    throw e;
                }
                skipBlank();
                // Handle comma or end of object
                if (jsonString[index] === ",") {
                    index++; // skip comma
                    skipBlank();
                    // If next character is '}', it's the end of the object
                    if (jsonString[index] === "}") {
                        break;
                    }
                }
            }
        }
        catch (e) {
            if ((isOutermost && allow & options_1.Allow.OUTERMOST_OBJ) || allow & options_1.Allow.OBJ) {
                return obj;
            }
            else {
                markPartialJSON("Expected '}' at end of object");
            }
        }
        if (jsonString[index] === "}") {
            index++; // skip final brace
            return obj;
        }
        // If we reach here, the object was not properly closed
        if ((isOutermost && allow & options_1.Allow.OUTERMOST_OBJ) || allow & options_1.Allow.OBJ) {
            return obj;
        }
        markPartialJSON("Expected '}' at end of object");
    };
    const parseArr = () => {
        const isOutermost = arrayDepth === 1;
        index++; // skip initial bracket
        const arr = [];
        try {
            while (jsonString[index] !== "]") {
                skipBlank();
                if (index >= length) {
                    if ((isOutermost && allow & options_1.Allow.OUTERMOST_ARR) ||
                        allow & options_1.Allow.ARR) {
                        return arr;
                    }
                    markPartialJSON("Unexpected end of array");
                }
                // Parse value
                const value = parseAny();
                arr.push(value);
                skipBlank();
                // Handle comma or end of array
                if (jsonString[index] === ",") {
                    index++; // skip comma
                    skipBlank();
                    // If next character is ']', it's the end of the array
                    if (jsonString[index] === "]") {
                        break;
                    }
                }
            }
        }
        catch (e) {
            if ((isOutermost && allow & options_1.Allow.OUTERMOST_ARR) || allow & options_1.Allow.ARR) {
                return arr;
            }
            throw e;
        }
        if (jsonString[index] === "]") {
            index++; // skip final bracket
            return arr;
        }
        // If we reach here, the array was not properly closed
        if ((isOutermost && allow & options_1.Allow.OUTERMOST_ARR) || allow & options_1.Allow.ARR) {
            return arr;
        }
        markPartialJSON("Expected ']' at end of array");
    };
    const parseNum = () => {
        const start = index;
        // Handle negative sign
        if (jsonString[index] === "-")
            index++;
        // Integral part
        while (index < length && /[0-9]/.test(jsonString[index])) {
            index++;
        }
        // Fractional part
        if (jsonString[index] === ".") {
            index++;
            while (index < length && /[0-9]/.test(jsonString[index])) {
                index++;
            }
        }
        // Exponent part
        if (jsonString[index] === "e" || jsonString[index] === "E") {
            index++;
            if (jsonString[index] === "+" || jsonString[index] === "-") {
                index++;
            }
            while (index < length && /[0-9]/.test(jsonString[index])) {
                index++;
            }
        }
        const numStr = jsonString.substring(start, index);
        try {
            return JSON.parse(numStr);
        }
        catch (e) {
            if (options_1.Allow.NUM & allow) {
                // Attempt to parse the valid part of the number
                const validMatch = numStr.match(/^-?\d+(\.\d+)?([eE][+-]?\d+)?/);
                if (validMatch && validMatch[0]) {
                    try {
                        return JSON.parse(validMatch[0]);
                    }
                    catch (_) { }
                }
            }
            throwMalformedError(`Invalid number '${numStr}'`);
        }
    };
    const skipBlank = () => {
        while (index < length && " \n\r\t".includes(jsonString[index])) {
            index++;
        }
    };
    const result = parseAny();
    skipBlank();
    if (index < length) {
        throwMalformedError(`Unexpected token '${jsonString[index]}'`);
    }
    return result;
};
const parse = parseJSON;
exports.parse = parse;
