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
  return _parseJSON(jsonString.trim(), allowPartial);
}

const _parseJSON = (jsonString: string, allow: number) => {
  const length = jsonString.length;
  let index = 0;
  let depth = 0; // Initialize depth counter

  const markPartialJSON = (msg: string) => {
    throw new PartialJSON(`${msg} at position ${index}`);
  };

  const throwMalformedError = (msg: string) => {
    throw new MalformedJSON(`${msg} at position ${index}`);
  };

  const parseAny: () => any = () => {
    skipBlank();
    if (index >= length) markPartialJSON("Unexpected end of input");
    const currentChar = jsonString[index];

    // Handle string
    if (currentChar === '"') return parseStr();

    // Handle object
    if (currentChar === "{") {
      depth++;
      const result = parseObj();
      depth--;
      return result;
    }

    // Handle array
    if (currentChar === "[") {
      depth++;
      const result = parseArr();
      depth--;
      return result;
    }

    // Handle literals and numbers
    if (
      jsonString.substring(index, index + 4) === "null" ||
      (Allow.NULL & allow &&
        length - index < 4 &&
        "null".startsWith(jsonString.substring(index)))
    ) {
      index += 4;
      return null;
    }
    if (
      jsonString.substring(index, index + 4) === "true" ||
      (Allow.BOOL & allow &&
        length - index < 4 &&
        "true".startsWith(jsonString.substring(index)))
    ) {
      index += 4;
      return true;
    }
    if (
      jsonString.substring(index, index + 5) === "false" ||
      (Allow.BOOL & allow &&
        length - index < 5 &&
        "false".startsWith(jsonString.substring(index)))
    ) {
      index += 5;
      return false;
    }
    if (
      jsonString.substring(index, index + 8) === "Infinity" ||
      (Allow.INFINITY & allow &&
        length - index < 8 &&
        "Infinity".startsWith(jsonString.substring(index)))
    ) {
      index += 8;
      return Infinity;
    }
    if (
      jsonString.substring(index, index + 9) === "-Infinity" ||
      (Allow._INFINITY & allow &&
        1 < length - index &&
        length - index < 9 &&
        "-Infinity".startsWith(jsonString.substring(index)))
    ) {
      index += 9;
      return -Infinity;
    }
    if (
      jsonString.substring(index, index + 3) === "NaN" ||
      (Allow.NAN & allow &&
        length - index < 3 &&
        "NaN".startsWith(jsonString.substring(index)))
    ) {
      index += 3;
      return NaN;
    }
    return parseNum();
  };

  const parseStr: () => string = () => {
    const start = index;
    let escape = false;
    index++; // skip initial quote
    while (index < length && (jsonString[index] !== '"' || escape)) {
      if (jsonString[index] === "\\") {
        escape = !escape;
      } else {
        escape = false;
      }
      index++;
    }
    if (jsonString.charAt(index) === '"') {
      try {
        return JSON.parse(jsonString.substring(start, ++index));
      } catch (e) {
        throwMalformedError(String(e));
      }
    } else if (Allow.STR & allow) {
      try {
        // Attempt to close the string properly
        return JSON.parse(jsonString.substring(start, index) + '"');
      } catch (e) {
        // Remove the trailing backslash if present
        const lastBackslash = jsonString.lastIndexOf("\\");
        if (lastBackslash > start) {
          return JSON.parse(jsonString.substring(start, lastBackslash) + '"');
        }
        throwMalformedError("Unterminated string literal");
      }
    }
    markPartialJSON("Unterminated string literal");
  };

  const parseObj = () => {
    const isOutermost = depth === 1;
    index++; // skip initial brace
    skipBlank();
    const obj: Record<string, any> = {};
    try {
      while (jsonString[index] !== "}") {
        skipBlank();
        if (index >= length) {
          if (
            (isOutermost && allow & Allow.OUTERMOST_OBJ) ||
            allow & Allow.OBJ
          ) {
            return obj;
          }
          markPartialJSON("Unexpected end of object");
        }
        const key = parseStr();
        skipBlank();
        if (jsonString[index] !== ":") {
          throwMalformedError(`Expected ':' after key "${key}"`);
        }
        index++; // skip colon
        try {
          const value = parseAny();
          obj[key] = value;
        } catch (e) {
          if (
            (isOutermost && allow & Allow.OUTERMOST_OBJ) ||
            allow & Allow.OBJ
          ) {
            return obj;
          } else throw e;
        }
        skipBlank();
        if (jsonString[index] === ",") index++; // skip comma
      }
    } catch (e) {
      if ((isOutermost && allow & Allow.OUTERMOST_OBJ) || allow & Allow.OBJ) {
        return obj;
      } else {
        markPartialJSON("Expected '}' at end of object");
      }
    }
    index++; // skip final brace
    return obj;
  };

  const parseArr = () => {
    const isOutermost = depth === 1;
    index++; // skip initial bracket
    const arr: any[] = [];
    try {
      while (jsonString[index] !== "]") {
        skipBlank();
        if (index >= length) {
          if (
            (isOutermost && allow & Allow.OUTERMOST_ARR) ||
            allow & Allow.ARR
          ) {
            return arr;
          }
          markPartialJSON("Unexpected end of array");
        }
        const value = parseAny();
        arr.push(value);
        skipBlank();
        if (jsonString[index] === ",") index++; // skip comma
      }
    } catch (e) {
      if ((isOutermost && allow & Allow.OUTERMOST_ARR) || allow & Allow.ARR) {
        return arr;
      }
      markPartialJSON("Expected ']' at end of array");
    }
    index++; // skip final bracket
    return arr;
  };

  const parseNum = () => {
    const start = index;

    if (jsonString[index] === "-") index++;
    while (index < length && /[0-9eE.+-]/.test(jsonString[index])) {
      index++;
    }

    const numStr = jsonString.substring(start, index);

    try {
      return JSON.parse(numStr);
    } catch (e) {
      if (allow & Allow.NUM) {
        // Attempt to parse the valid part of the number
        const validPart = numStr.match(/^-?\d+(\.\d+)?([eE][+-]?\d+)?/);
        if (validPart) {
          try {
            return JSON.parse(validPart[0]);
          } catch (_) {}
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

export { parse, parseJSON, PartialJSON, MalformedJSON, Allow };
