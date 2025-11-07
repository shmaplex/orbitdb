import { toString as uint8ArrayToString } from "uint8arrays/to-string";
import type { KeyStoreInstance } from "../../key-store";
import { signMessage, verifyMessage } from "../../key-store.js";
import type { IdentityType } from "../identity";

/**
 * Interface for the PublicKeyIdentityProvider instance
 */
export interface PublicKeyIdentityProviderInstance {
  type: string;
  getId: (params: { id: string }) => Promise<string>;
  signIdentity: (
    data: string | Uint8Array,
    params: { id: string }
  ) => Promise<string>;
}

const type = "publickey";

/**
 * Verifies an identity using the identity's id and public key signature.
 * @param identity Identity to verify
 * @returns True if the identity is valid, false otherwise
 * @static
 * @private
 */
const verifyIdentity = async (identity: IdentityType): Promise<boolean> => {
  const { id, publicKey, signatures } = identity;
  // Using string concatenation of publicKey + id signature as in original logic
  return verifyMessage(
    signatures.publicKey as string,
    id,
    (publicKey as any) + (signatures.id as string)
  );
};

/**
 * Instantiates the PublicKey identity provider.
 * @param params Provider parameters
 * @param params.keystore A KeyStoreInstance
 * @returns An async function returning the identity provider interface
 * @memberof module:IdentityProviders
 * @private
 */
const PublicKeyIdentityProvider =
  ({ keystore }: { keystore: KeyStoreInstance }) =>
  async (): Promise<PublicKeyIdentityProviderInstance> => {
    if (!keystore) {
      throw new Error(
        "PublicKeyIdentityProvider requires a keystore parameter"
      );
    }

    const getId = async ({ id }: { id: string }): Promise<string> => {
      if (!id) throw new Error("id is required");

      const key = (await keystore.getKey(id)) || (await keystore.createKey(id));
      return uint8ArrayToString(key.publicKey.raw, "base16");
    };

    const signIdentity = async (
      data: string | Uint8Array,
      { id }: { id: string }
    ): Promise<string> => {
      if (!id) throw new Error("id is required");

      const key = await keystore.getKey(id);
      if (!key) throw new Error(`Signing key for '${id}' not found`);

      return signMessage(key, data);
    };

    return { type, getId, signIdentity };
  };

// Attach static properties
PublicKeyIdentityProvider.verifyIdentity = verifyIdentity;
PublicKeyIdentityProvider.type = type;

export default PublicKeyIdentityProvider;
