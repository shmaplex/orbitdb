/**
 * A no-op identity provider that does not implement any identity methods or type.
 * Can be used as a placeholder or default provider.
 */
const NoTypeIdentityProvider =
  () =>
  /** @returns A promise that resolves to an empty provider object */
  async (): Promise<Record<string, never>> => {
    return {};
  };

export default NoTypeIdentityProvider;
