/**
 * The type of the fake identity provider.
 */
const type = "fake";

/**
 * Verifies the identity data.
 * @param data - The data to verify.
 * @returns A promise that resolves to `false` because this is a fake provider.
 */
const verifyIdentity = async (data: unknown): Promise<boolean> => {
  return false;
};

/**
 * Factory function for creating a fake identity provider.
 * @returns An async function that resolves to the identity provider API.
 */
const FakeIdentityProvider =
  () =>
  /** @returns Promise of identity provider API */
  async () => {
    /**
     * Returns the ID of the identity provider.
     * @returns The string ID of the provider.
     */
    const getId = (): string => {
      return "pubKey";
    };

    /**
     * Signs identity data.
     * @param data - The data to sign.
     * @returns A fake signature string.
     */
    const signIdentity = (data: unknown): string => {
      return `false signature '${data}'`;
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
FakeIdentityProvider.verifyIdentity = verifyIdentity;

/**
 * The type of the provider.
 */
FakeIdentityProvider.type = type;

export default FakeIdentityProvider;
