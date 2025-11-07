// src/utils/path-join.ts
/**
 * @module path-join
 * @description Cross-platform path joining utilities (POSIX and Windows).
 * These functions normalize redundant separators and relative markers.
 */

/**
 * Joins multiple path segments using POSIX (Unix-style) separators.
 *
 * @param {...string} paths - Path segments to join.
 * @returns {string} A normalized POSIX-style path string.
 *
 * @example
 * posixJoin('folder', 'subfolder', './file.txt')
 * // → "folder/subfolder/file.txt"
 */
export const posixJoin = (...paths: string[]): string =>
  paths
    .join("/")
    // Remove duplicate slashes, leading "./", and "./" after slashes.
    .replace(/((?<=\/)\/+)|(^\.\/)|((?<=\/)\.\/)/g, "") || ".";

/**
 * Joins multiple path segments using Windows (backslash-style) separators.
 *
 * @param {...string} paths - Path segments to join.
 * @returns {string} A normalized Windows-style path string.
 *
 * @example
 * win32Join('folder', 'subfolder', './file.txt')
 * // → "folder\\subfolder\\file.txt"
 */
export const win32Join = (...paths: string[]): string =>
  paths
    .join("\\")
    .replace(/\//g, "\\")
    // Remove duplicate backslashes, leading ".\", and ".\" after backslashes.
    .replace(/((?<=\\)\\+)|(^\.\\)|((?<=\\)\.\\)/g, "") || ".";

/**
 * Alias for {@link posixJoin}.
 *
 * @type {(…paths: string[]) => string}
 * @example
 * join('src', 'utils', 'index.js')
 * // → "src/utils/index.js"
 */
export const join: (...paths: string[]) => string = posixJoin;

/**
 * Default export for POSIX-style joining.
 *
 * @type {(…paths: string[]) => string}
 */
export default posixJoin;
