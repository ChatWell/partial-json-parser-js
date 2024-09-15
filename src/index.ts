import { Allow } from "./options";
export * from "./options";

class PartialJSON extends Error {}

class MalformedJSON extends Error {}

/**
 * Parse incomplete JSON
 * @param {string} jsonString Partial JSON to be parsed
 * @param {number} allowPartial Specify what types are allowed to be partial, see {@link Allow} for details
 * @returns The parsed JSON
 * @throws {PartialJSON} If the JSON is incomplete (related to the `allow` parameter)
 * @throws {MalformedJSON} If the JSON is malformed
 */
function parseJSON(jsonString: string, allowPartial: number = Allow.ALL): any {
  if (typeof jsonString !== "string") {
    throw new TypeError(`expecting str, got ${typeof jsonString}`);
  }
  if (!jsonString.trim()) {
    throw new Error(`${jsonString} is empty`);
  }
  const _parseJSON = (jsonString: string, allow: number) => {
    const length = jsonString.length;
    let depth = 0; // Track the current depth
    let index = 0; // Initialize index

    const markPartialJSON = (msg: string) => {
      throw new PartialJSON(`${msg} at position ${index}`);
    };

    const throwMalformedError = (msg: string) => {
      throw new MalformedJSON(`${msg} at position ${index}`);
    };

    const parseAny: (currentAllow: number) => any = (currentAllow) => {
      skipBlank();
      if (index >= length) markPartialJSON("Unexpected end of input");
      if (jsonString[index] === '"') return parseStr(currentAllow);
      if (jsonString[index] === "{") return parseObj(currentAllow);
      if (jsonString[index] === "[") return parseArr(currentAllow);
      if (
        jsonString.substring(index, index + 4) === "null" ||
        (Allow.NULL & currentAllow &&
          length - index < 4 &&
          "null".startsWith(jsonString.substring(index)))
      ) {
        index += 4;
        return null;
      }
      if (
        jsonString.substring(index, index + 4) === "true" ||
        (Allow.BOOL & currentAllow &&
          length - index < 4 &&
          "true".startsWith(jsonString.substring(index)))
      ) {
        index += 4;
        return true;
      }
      if (
        jsonString.substring(index, index + 5) === "false" ||
        (Allow.BOOL & currentAllow &&
          length - index < 5 &&
          "false".startsWith(jsonString.substring(index)))
      ) {
        index += 5;
        return false;
      }
      if (
        jsonString.substring(index, index + 8) === "Infinity" ||
        (Allow.INFINITY & currentAllow &&
          length - index < 8 &&
          "Infinity".startsWith(jsonString.substring(index)))
      ) {
        index += 8;
        return Infinity;
      }
      if (
        jsonString.substring(index, index + 9) === "-Infinity" ||
        (Allow._INFINITY & currentAllow &&
          1 < length - index &&
          length - index < 9 &&
          "-Infinity".startsWith(jsonString.substring(index)))
      ) {
        index += 9;
        return -Infinity;
      }
      if (
        jsonString.substring(index, index + 3) === "NaN" ||
        (Allow.NAN & currentAllow &&
          length - index < 3 &&
          "NaN".startsWith(jsonString.substring(index)))
      ) {
        index += 3;
        return NaN;
      }
      return parseNum(currentAllow); // Pass currentAllow
    };

    const parseStr: (currentAllow: number) => string = (currentAllow) => {
      const start = index;
      let escape = false;
      index++; // skip initial quote
      while (
        index < length &&
        (jsonString[index] !== '"' ||
          (escape && jsonString[index - 1] === "\\"))
      ) {
        escape = jsonString[index] === "\\" ? !escape : false;
        index++;
      }
      if (jsonString.charAt(index) == '"') {
        try {
          return JSON.parse(
            jsonString.substring(start, ++index - Number(escape))
          );
        } catch (e) {
          throwMalformedError(String(e));
        }
      } else if (Allow.STR & currentAllow) { // Use currentAllow
        try {
          return JSON.parse(
            jsonString.substring(start, index - Number(escape)) + '"'
          );
        } catch (e) {
          // SyntaxError: Invalid escape sequence
          return JSON.parse(
            jsonString.substring(start, jsonString.lastIndexOf("\\")) + '"'
          );
        }
      }
      markPartialJSON("Unterminated string literal");
    };

    const parseObj: (currentAllow: number) => any = (currentAllow) => {
      if (Allow.OUTERMOST_OBJ && depth > 0 && !(Allow.OBJ & currentAllow)) { // Use currentAllow
        throwMalformedError("Nested objects must be complete");
      }
      depth++;
      index++; // skip initial brace
      skipBlank();
      const obj: Record<string, any> = {};
      try {
        while (jsonString[index] !== "}") {
          skipBlank();
          if (
            index >= length &&
            (Allow.OBJ & currentAllow || (Allow.OUTERMOST_OBJ & currentAllow && depth === 1)) // Use currentAllow
          )
            return obj;
          const key = parseStr(currentAllow); // Pass currentAllow
          skipBlank();
          index++; // skip colon
          try {
            const value = parseAny(currentAllow); // Pass currentAllow
            obj[key] = value;
          } catch (e) {
            if (
              Allow.OBJ & currentAllow ||
              (Allow.OUTERMOST_OBJ & currentAllow && depth === 1) // Use currentAllow
            )
              return obj;
            else throw e;
          }
          skipBlank();
          if (jsonString[index] === ",") index++; // skip comma
        }
      } catch (e) {
        if (Allow.OBJ & currentAllow || (Allow.OUTERMOST_OBJ & currentAllow && depth === 1)) // Use currentAllow
          return obj;
        else markPartialJSON("Expected '}' at end of object");
      }
      index++; // skip final brace
      depth--;
      return obj;
    };

    const parseArr: (currentAllow: number) => any = (currentAllow) => {
      const isOutermost = depth === 0;

      depth++;
      index++; // skip initial bracket
      const arr = [];
      try {
        while (jsonString[index] !== "]") {
          try {
            // Allow OBJ when ARR is allowed to parse objects within arrays
            const elementAllow = currentAllow | Allow.OBJ; // Use currentAllow
            const element = parseAny(elementAllow); // Pass elementAllow
            
            // Check if the element is an empty object and we're using OUTERMOST_ARR
            if (isOutermost && (Allow.OUTERMOST_ARR & currentAllow) && 
                Object.keys(element).length === 0 && element.constructor === Object) {
              break; // Stop parsing if we encounter an empty object at the end
            }
            
            arr.push(element);
          } catch (e) {
            if (
              Allow.ARR & currentAllow || // Use currentAllow
              (Allow.OUTERMOST_ARR & currentAllow && isOutermost) // Use currentAllow
            ) {
              break;
            }
            throw e;
          }
          skipBlank();
          if (jsonString[index] === ",") {
            index++; // skip comma
          }
        }
      } catch (e) {
        if (Allow.ARR & currentAllow || (Allow.OUTERMOST_ARR & currentAllow && isOutermost)) { // Use currentAllow
          return arr;
        }
        markPartialJSON("Expected ']' at end of array");
      }
      if (jsonString[index] === "]") {
        index++; // skip final bracket
      }
      depth--;
      return arr;
    };

    const parseNum: (currentAllow: number) => any = (currentAllow) => { // Add currentAllow
      if (index === 0) {
        if (jsonString === "-") throwMalformedError("Not sure what '-' is");
        try {
          return JSON.parse(jsonString);
        } catch (e) {
          if (Allow.NUM & currentAllow) // Use currentAllow
            try {
              return JSON.parse(
                jsonString.substring(0, jsonString.lastIndexOf("e"))
              );
            } catch (e) {}
          throwMalformedError(String(e));
        }
      }

      const start = index;

      if (jsonString[index] === "-") index++;
      while (jsonString[index] && ",]}".indexOf(jsonString[index]) === -1)
        index++;

      if (index == length && !(Allow.NUM & currentAllow)) // Use currentAllow
        markPartialJSON("Unterminated number literal");

      try {
        return JSON.parse(jsonString.substring(start, index));
      } catch (e) {
        if (jsonString.substring(start, index) === "-")
          markPartialJSON("Not sure what '-' is");
        try {
          return JSON.parse(
            jsonString.substring(start, jsonString.lastIndexOf("e"))
          );
        } catch (e) {
          throwMalformedError(String(e));
        }
      }
    };

    const skipBlank = () => {
      while (index < length && " \n\r\t".includes(jsonString[index])) {
        index++;
      }
    };
    return parseAny(allow);
  };

  return _parseJSON(jsonString.trim(), allowPartial);
}

const parse = parseJSON;

export { parse, parseJSON, PartialJSON, MalformedJSON, Allow };
