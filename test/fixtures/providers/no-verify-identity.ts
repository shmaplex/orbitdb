/**
 * An identity provider that only exposes a type and does not implement verification,
 * signing, or identity retrieval. Can be used as a placeholder provider where
 * identity operations are not required.
 */
const type = "no-verify-identity";

/**
 * Factory function returning an async provider object.
 * @returns Promise resolving to an object containing only the type.
 */
const NoVerifyIdentityIdentityProvider =
  () => async (): Promise<{ type: string }> => {
    return { type };
  };

/** Static type property for reference without instantiation */
NoVerifyIdentityIdentityProvider.type = type;

export default NoVerifyIdentityIdentityProvider;
