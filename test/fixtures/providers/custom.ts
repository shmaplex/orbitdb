/**
 * The type of the custom identity provider.
 */
const type = "custom";

/**
 * Verifies the identity data.
 * @param data - The data to verify.
 * @returns A promise that resolves to `true` if verification is successful.
 */
const verifyIdentity = async (data: unknown): Promise<boolean> => {
  return true;
};

/**
 * Factory function for creating a custom identity provider.
 * @returns An async function that resolves to the identity provider API.
 */
const CustomIdentityProvider =
  () =>
  /** @returns Promise of identity provider API */
  async () => {
    /**
     * Returns the ID of the identity provider.
     * @returns The string ID of the provider.
     */
    const getId = (): string => {
      return "custom";
    };

    /**
     * Signs identity data.
     * @param data - The data to sign.
     * @returns A signature string.
     */
    const signIdentity = (data: unknown): string => {
      return `signature '${data}'`;
    };

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
