"use strict";
/**
 * Sometimes you don't allow every type to be partially parsed.
 * For example, you may not want a partial number because it may increase its size gradually before it's complete.
 * In this case, you can use the `Allow` object to control what types you allow to be partially parsed.
 * @module
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Allow = exports.ALL = exports.COLLECTION = exports.ATOM = exports.SPECIAL = exports.INF = exports.OUTERMOST_ARR = exports.OUTERMOST_OBJ = exports._INFINITY = exports.INFINITY = exports.NAN = exports.BOOL = exports.NULL = exports.OBJ = exports.ARR = exports.NUM = exports.STR = void 0;
/**
 * Allow partial strings like `"hello \u12` to be parsed as `"hello "`
 */
exports.STR = 0b000000001; // 1
/**
 * Allow partial numbers like `123.` to be parsed as `123`
 */
exports.NUM = 0b000000010; // 2
/**
 * Allow partial arrays like `[1, 2,` to be parsed as `[1, 2]`
 */
exports.ARR = 0b000000100; // 4
/**
 * Allow partial objects like `{"a": 1, "b":` to be parsed as `{"a": 1}`
 */
exports.OBJ = 0b000001000; // 8
/**
 * Allow `nu` to be parsed as `null`
 */
exports.NULL = 0b000010000; // 16
/**
 * Allow `tr` to be parsed as `true`, and `fa` to be parsed as `false`
 */
exports.BOOL = 0b000100000; // 32
/**
 * Allow `Na` to be parsed as `NaN`
 */
exports.NAN = 0b001000000; // 64
/**
 * Allow `Inf` to be parsed as `Infinity`
 */
exports.INFINITY = 0b010000000; // 128
/**
 * Allow `-Inf` to be parsed as `-Infinity`
 */
exports._INFINITY = 0b100000000; // 256
/**
 * Allow partial parsing of the outermost JSON object
 */
exports.OUTERMOST_OBJ = 0b0000000100000000; // 512
/**
 * Allow partial parsing of the outermost JSON array
 */
exports.OUTERMOST_ARR = 0b0000001000000000; // 1024
exports.INF = exports.INFINITY | exports._INFINITY; // 384
exports.SPECIAL = exports.NULL | exports.BOOL | exports.INF | exports.NAN; // 432
exports.ATOM = exports.STR | exports.NUM | exports.SPECIAL; // 499
exports.COLLECTION = exports.ARR | exports.OBJ; // 12
exports.ALL = exports.ATOM | exports.COLLECTION; // 511
/**
 * Control what types you allow to be partially parsed.
 * The default is to allow all types to be partially parsed, which in most cases is the best option.
 * @example
 * If you don't want to allow partial objects, you can use the following code:
 * ```ts
 * import { Allow, parse } from "partial-json";
 * parse(`[{"a": 1, "b": 2}, {"a": 3,`, Allow.ARR); // [ { a: 1, b: 2 } ]
 * ```
 * Or you can use `~` to disallow a type:
 * ```ts
 * parse(`[{"a": 1, "b": 2}, {"a": 3,`, ~Allow.OBJ); // [ { a: 1, b: 2 } ]
 * ```
 * @example
 * If you don't want to allow partial strings, you can use the following code:
 * ```ts
 * import { Allow, parse } from "partial-json";
 * parse(`["complete string", "incompl`, ~Allow.STR); // [ 'complete string' ]
 * ```
 */
exports.Allow = {
    STR: exports.STR,
    NUM: exports.NUM,
    ARR: exports.ARR,
    OBJ: exports.OBJ,
    NULL: exports.NULL,
    BOOL: exports.BOOL,
    NAN: exports.NAN,
    INFINITY: exports.INFINITY,
    _INFINITY: exports._INFINITY,
    OUTERMOST_OBJ: exports.OUTERMOST_OBJ,
    OUTERMOST_ARR: exports.OUTERMOST_ARR,
    INF: exports.INF,
    SPECIAL: exports.SPECIAL,
    ATOM: exports.ATOM,
    COLLECTION: exports.COLLECTION,
    ALL: exports.ALL,
};
exports.default = exports.Allow;
