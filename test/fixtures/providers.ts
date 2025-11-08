export interface GenericIdentityProviderInstance {
  type: string;
  getId: (params: { id?: string }) => Promise<string>;
  signIdentity: (
    data: string | Uint8Array,
    params: { id?: string }
  ) => Promise<string>;
}

/**
 * Custom Identity Provider
 * Always verifies true
 */
const customIdentityProvider = () => {
  const verifyIdentity = async (data: unknown): Promise<boolean> => true;

  const CustomIdentityProvider =
    () => async (): Promise<GenericIdentityProviderInstance> => {
      const getId = async ({ id }: { id?: string } = {}): Promise<string> =>
        "custom";
      const signIdentity = async (
        data: string | Uint8Array,
        { id }: { id?: string } = {}
      ): Promise<string> => `signature '${data}'`;

      return {
        getId,
        signIdentity,
        type: "custom",
      };
    };

  return {
    default: CustomIdentityProvider,
    type: "custom",
    verifyIdentity,
  };
};

/**
 * Fake Identity Provider
 * Always verifies false
 */
const fakeIdentityProvider = () => {
  const verifyIdentity = async (data: unknown): Promise<boolean> => false;

  const FakeIdentityProvider =
    () => async (): Promise<GenericIdentityProviderInstance> => {
      const getId = async ({ id }: { id?: string } = {}): Promise<string> =>
        "pubKey";
      const signIdentity = async (
        data: string | Uint8Array,
        { id }: { id?: string } = {}
      ): Promise<string> => `false signature '${data}'`;

      return {
        getId,
        signIdentity,
        type: "fake",
      };
    };

  return {
    default: FakeIdentityProvider,
    type: "fake",
    verifyIdentity,
  };
};

const CustomIdentityProvider = customIdentityProvider();
const FakeIdentityProvider = fakeIdentityProvider();

export { CustomIdentityProvider, FakeIdentityProvider };
