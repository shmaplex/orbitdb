import type { IdentityProvider } from "../../../src/identities";
import type { IdentityType } from "../../../src/identities/identity";

/**
 * The type identifier of this custom identity provider.
 */
const type = "custom";

/**
 * Verifies the identity data.
 * @param identity - The identity object to verify.
 * @returns Resolves to `true` if verification is successful.
 */
const verifyIdentity = async (identity: IdentityType): Promise<boolean> => true;

/**
 * Factory function for creating a custom identity provider instance.
 * Can be used with `useIdentityProvider` for OrbitDB identities.
 *
 * @returns Promise resolving to the provider API object.
 */
const CustomIdentityProvider = (): IdentityProvider => ({
  /**
   * The type of the provider.
   */
  type,

  /**
   * Returns the unique ID of this identity provider.
   * @param options - Optional identity provider options.
   * @returns Resolves to the ID string.
   */
  getId: async (options?: any): Promise<string> => {
    return "custom";
  },

  /**
   * Signs the given identity data.
   * @param data - The data to sign.
   * @param options - Optional identity provider options.
   * @returns Resolves to a string representing the signature.
   */
  signIdentity: async (data: unknown, options?: any): Promise<string> => {
    return `signature '${data}'`;
  },

  /**
   * Verifies an identity object.
   * @param identity - The identity to verify.
   * @returns Resolves to `true` if verification succeeds.
   */
  verifyIdentity,
});

/**
 * Static helper for verifying identities without instantiating the provider.
 */
CustomIdentityProvider.verifyIdentity = verifyIdentity;

/**
 * Static type identifier for convenience.
 */
CustomIdentityProvider.type = type;

export default CustomIdentityProvider;
