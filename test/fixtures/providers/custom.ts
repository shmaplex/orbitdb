import { IdentityProvider } from "../../../src/identities";

/**
 * The type of the custom identity provider.
 */
const type = "custom";

/**
 * Verifies the identity data.
 * @param data - The data to verify.
 * @returns A promise that resolves to `true` if verification is successful.
 */
const verifyIdentity = async (data: unknown): Promise<boolean> => true;

/**
 * Factory function for creating a custom identity provider.
 * Returns an async function to keep backward compatibility.
 */
const CustomIdentityProvider =
  () =>
  /** @returns Promise of identity provider API */
  async () => {
    /**
     * Returns the ID of the identity provider.
     */
    const getId = (): string => "custom";

    /**
     * Signs identity data.
     * @param data - The data to sign.
     */
    const signIdentity = (data: unknown): string => `signature '${data}'`;

    return {
      getId,
      signIdentity,
      type,
    };
  };

/**
 * Static method to verify identity without instantiating the provider.
 */
CustomIdentityProvider.verifyIdentity = verifyIdentity;

/**
 * The type of the provider.
 */
CustomIdentityProvider.type = type;

export default CustomIdentityProvider;
