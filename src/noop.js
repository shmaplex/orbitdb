/**
 * noop.js
 *
 * A harmless stub module used to replace Node-only packages like `fsevents`
 * when bundling for environments that don't support native bindings.
 */

export default {};
// CommonJS fallback for packages that use `require()`
module.exports = {};
