/**
 * @module Identity
 * @description Centralized exports for identity management.
 */

// --- Identities ---
/**
 * @module Identity~Identities
 * @description Collection of identity utilities and identity management instance.
 */
export type { IdentitiesInstance } from "./identities";
export { default as Identities } from "./identities"; // ✅ re-export default as named
export type { IdentityType } from "./identity";
// --- Identity ---
/**
 * @module Identity~Identity
 * @description Individual identity operations and helpers.
 * @property isIdentity Checks if a value is an Identity
 * @property isEqual Compares two identities for equality
 * @property decodeIdentity Decodes bytes into an Identity
 */
export {
  decodeIdentity,
  default as Identity,
  isEqual,
  isIdentity,
} from "./identity";
export type { IdentityProvider } from "./providers";
// --- Providers ---
/**
 * @module Identity~Providers
 * @description Hooks and classes for identity providers.
 * @property useIdentityProvider Register a custom identity provider
 * @property getIdentityProvider Retrieve a registered identity provider
 * @property PublicKeyIdentityProvider Default implementation using public key
 */
export {
  getIdentityProvider,
  PublicKeyIdentityProvider,
  useIdentityProvider,
} from "./providers";
