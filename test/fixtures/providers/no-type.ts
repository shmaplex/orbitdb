import { IdentityProvider } from "../../../src/identities";

/**
 * A no-op identity provider that does not implement any identity methods or type.
 * Can be used as a placeholder or default provider.
 */
const NoTypeIdentityProvider =
  (type: string) =>
  /** @returns A promise that resolves to an empty provider object */
  async (): Promise<IdentityProvider> => {
    return {
      type,
      verifyIdentity: async (_identity: any) => true, // minimal required method
    };
  };

export default NoTypeIdentityProvider;
