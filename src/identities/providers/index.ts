import PublicKeyIdentityProvider from "./publickey.js";

/**
 * Interface for an identity provider
 */
export interface IdentityProvider {
  type: string;
  verifyIdentity: (identity: any) => Promise<boolean>;
  [key: string]: any;
}

/**
 * Registry of available identity providers.
 * @private
 */
const identityProviders: Record<string, IdentityProvider> = {};

/**
 * Checks if a given identity provider type is supported.
 * @param type The identity provider type
 * @returns True if the provider is supported, false otherwise
 * @private
 */
const isProviderSupported = (type: string): boolean => {
  return Object.keys(identityProviders).includes(type);
};

/**
 * Retrieves a registered identity provider by type.
 * @param type The identity provider type
 * @returns The identity provider function
 * @throws Will throw if the provider type is not supported
 * @memberof module:Identities
 */
const getIdentityProvider = (type: string): IdentityProvider => {
  if (!isProviderSupported(type)) {
    throw new Error(`IdentityProvider type '${type}' is not supported`);
  }

  return identityProviders[type];
};

/**
 * Registers an identity provider.
 * @param identityProvider The identity provider to register
 * @throws Will throw if provider lacks 'type' or 'verifyIdentity'
 * @throws Will throw if the provider is already registered
 * @memberof module:Identities
 * @static
 */
const useIdentityProvider = (identityProvider: IdentityProvider) => {
  if (!identityProvider.type || typeof identityProvider.type !== "string") {
    throw new Error("Given IdentityProvider doesn't have a field 'type'.");
  }

  if (
    !identityProvider.verifyIdentity ||
    typeof identityProvider.verifyIdentity !== "function"
  ) {
    throw new Error(
      "Given IdentityProvider doesn't have a function 'verifyIdentity'."
    );
  }

  if (identityProviders[identityProvider.type]) {
    throw new Error(
      `IdentityProvider '${identityProvider.type}' already added.`
    );
  }

  identityProviders[identityProvider.type] = identityProvider;
};

// Register the default PublicKeyIdentityProvider
useIdentityProvider(PublicKeyIdentityProvider);

export {
  useIdentityProvider,
  getIdentityProvider,
  PublicKeyIdentityProvider,
  identityProviders,
};
