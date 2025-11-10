import type { KeyStoreType } from "../../key-store.js";
import type { IdentityType } from "../identity.js";
import PublicKeyIdentityProvider from "./publickey.js";

export interface IdentityProviderOptions {
  keystore?: KeyStoreType;
  id?: string;
  [key: string]: unknown; // allows future extension
}

/**
 * Interface for an identity provider
 */
export interface IdentityProvider {
  type: string;
  getId?: (options?: IdentityProviderOptions) => Promise<string>;
  signIdentity?: (
    data: unknown,
    options?: IdentityProviderOptions
  ) => Promise<string>;
  verifyIdentity: (identity: IdentityType) => Promise<boolean>;
  // [key: string]: any;
}

/**
 * Internal registry of available identity providers.
 * @private
 */
const identityProviders: Record<string, IdentityProvider> = {};

/**
 * Checks if a given identity provider type is supported.
 * @param type The identity provider type
 * @returns True if the provider is supported
 * @private
 */
const isProviderSupported = (type: string): boolean => {
  return Object.keys(identityProviders).includes(type);
};

/**
 * Retrieves a registered identity provider by type.
 * @param type The identity provider type
 * @returns The identity provider
 * @throws If the provider type is not supported
 */
const getIdentityProvider = (type: string): IdentityProvider => {
  if (!isProviderSupported(type)) {
    throw new Error(`IdentityProvider type '${type}' is not supported`);
  }
  return identityProviders[type];
};

/**
 * Registers a new identity provider.
 * @param identityProvider The provider to register
 * @throws If missing 'type' or 'verifyIdentity' function
 * @throws If the provider type is already registered
 */
const useIdentityProvider = (identityProvider: IdentityProvider): void => {
  if (!identityProvider.type || typeof identityProvider.type !== "string") {
    throw new Error("IdentityProvider must have a string 'type' property.");
  }

  if (
    !identityProvider.verifyIdentity ||
    typeof identityProvider.verifyIdentity !== "function"
  ) {
    throw new Error("IdentityProvider must have a 'verifyIdentity' function.");
  }

  if (identityProviders[identityProvider.type]) {
    throw new Error(
      `IdentityProvider '${identityProvider.type}' is already registered.`
    );
  }

  identityProviders[identityProvider.type] = identityProvider;
};

// Register built-in provider
useIdentityProvider(PublicKeyIdentityProvider);

export {
  useIdentityProvider,
  getIdentityProvider,
  PublicKeyIdentityProvider,
  identityProviders,
};
