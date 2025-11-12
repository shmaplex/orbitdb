import type { Helia } from "node_modules/helia/dist/src";
import type { KeyStoreInstance } from "../key-store";
import KeyStore, { signMessage, verifyMessage } from "../key-store";
import {
  ComposedStorage,
  IPFSBlockStorage,
  LRUStorage,
  MemoryStorage,
  type StorageBackend,
} from "../storage";
import { join as pathJoin } from "../utils";
import Identity, {
  decodeIdentity,
  type IdentityType,
  isEqual,
  isIdentity,
} from "./identity";
import { getIdentityProvider, type IdentityProvider } from "./providers";

const DefaultIdentityKeysPath = pathJoin("./orbitdb", "identities");

export interface IdentityOptions {
  provider?: IdentityProvider;
  keystore?: KeyStoreInstance;
  [key: string]: any;
}

export interface IdentitiesInstance {
  createIdentity: (options?: IdentityOptions) => Promise<IdentityType>;
  verifyIdentity: (identity: IdentityType) => Promise<boolean>;
  getIdentity: (hash: string) => Promise<IdentityType | undefined>;
  sign: (identity: IdentityType, data: string) => Promise<string>;
  verify: (
    signature: string,
    publicKey: string,
    data: string
  ) => Promise<boolean>;
  keystore: KeyStoreInstance;
}

const Identities = async ({
  keystore,
  path,
  storage,
  ipfs,
}: {
  keystore?: KeyStoreInstance;
  path?: string;
  storage?: StorageBackend;
  ipfs?: Helia;
} = {}): Promise<IdentitiesInstance> => {
  keystore =
    keystore || (await KeyStore({ path: path || DefaultIdentityKeysPath }));

  if (!storage) {
    storage = ipfs
      ? await ComposedStorage(
          await LRUStorage({ size: 1000 }),
          await IPFSBlockStorage({ ipfs, pin: true })
        )
      : await MemoryStorage();
  }

  const verifiedIdentitiesCache = await LRUStorage({ size: 1000 });

  const getIdentity = async (
    hash: string
  ): Promise<IdentityType | undefined> => {
    const bytes = await storage.get(hash);
    if (!bytes) return undefined;

    return decodeIdentity(
      bytes,
      async (...args: any[]) => args[0], // generic sign passthrough
      async (...args: any[]) => true // generic verify passthrough
    );
  };

  const createIdentity = async (
    options: IdentityOptions = {}
  ): Promise<IdentityType> => {
    options.keystore = keystore;

    const DefaultIdentityProvider = getIdentityProvider("publickey");
    const identityProvider: IdentityProvider =
      options.provider ?? DefaultIdentityProvider;

    if (!getIdentityProvider(identityProvider.type)) {
      throw new Error(
        "Identity provider is unknown. Use useIdentityProvider(provider) to register it."
      );
    }

    if (!identityProvider.getId) {
      throw new Error(
        `Identity provider ${identityProvider.type} is missing required method 'getId'`
      );
    }

    const id = await identityProvider.getId({
      ...options,
      keystore,
    });

    const privateKey =
      (await keystore.getKey(id)) || (await keystore.createKey(id));
    const publicKeyHex = keystore.getPublic(privateKey, "hex") as string;
    const publicKey = { raw: publicKeyHex };

    if (!identityProvider.signIdentity) {
      throw new Error(
        `Identity provider ${identityProvider.type} is missing required method 'signIdentity'`
      );
    }

    const idSignature = await signMessage(privateKey, id);
    const publicKeyAndIdSignature = await identityProvider.signIdentity(
      publicKeyHex + idSignature,
      { id }
    );

    const signatures = { id: idSignature, publicKey: publicKeyAndIdSignature };

    const signWrapper = async (...args: any[]): Promise<any> => {
      const data: Uint8Array = args[0];
      const sigHex = await signMessage(
        privateKey,
        Buffer.from(data).toString("hex")
      );
      return Uint8Array.from(Buffer.from(sigHex, "hex"));
    };

    const verifyWrapper = async (...args: any[]): Promise<boolean> => {
      const [data, signature] = args as [Uint8Array, Uint8Array];
      const sigHex = Buffer.from(signature).toString("hex");
      return verifyMessage(
        sigHex,
        publicKeyHex,
        Buffer.from(data).toString("hex")
      );
    };

    const identity = await Identity({
      id,
      publicKey,
      signatures,
      type: identityProvider.type,
      sign: signWrapper,
      verify: verifyWrapper,
    });

    if (identity.hash && identity.bytes) {
      await storage.put(identity.hash, identity.bytes);
    }

    return identity;
  };

  const verifyIdentity = async (identity: IdentityType): Promise<boolean> => {
    if (!isIdentity(identity)) return false;

    const { id, publicKey, signatures } = identity;
    const idSignatureVerified = await verifyMessage(
      signatures.id as string,
      publicKey,
      id
    );
    if (!idSignatureVerified) return false;

    const cachedIdentity = await verifiedIdentitiesCache.get(
      signatures.id as string
    );
    if (cachedIdentity && isIdentity(cachedIdentity)) {
      return isEqual(identity, cachedIdentity);
    }

    const Provider = getIdentityProvider(identity.type);
    const identityVerified = await Provider.verifyIdentity(identity);
    if (identityVerified) {
      await verifiedIdentitiesCache.put(signatures.id as string, identity);
    }

    return identityVerified;
  };

  const sign = async (...args: any[]): Promise<any> => {
    const [identity, data] = args as [IdentityType, string];
    const key = await keystore.getKey(identity.id);
    if (!key) throw new Error("Private signing key not found from KeyStore");
    return signMessage(key, data);
  };

  const verify = async (...args: any[]): Promise<boolean> => {
    const [signature, publicKey, data] = args as [string, string, string];
    return verifyMessage(signature, publicKey, data);
  };

  return {
    createIdentity,
    verifyIdentity,
    getIdentity,
    sign,
    verify,
    keystore,
  };
};

export default Identities;
