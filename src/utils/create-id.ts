// src/utils/create-id.ts
/**
 * Generate a random alphanumeric ID string.
 *
 * @param length - The length of the ID to generate. Defaults to 32.
 * @returns A promise that resolves to the generated ID string.
 *
 * @example
 * const id = await createId(); // e.g., "G7x9P1q2Ab..."
 * const shortId = await createId(8); // e.g., "zT1f8QrL"
 */
const createId = async (length = 32): Promise<string> => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return result;
};

export default createId;
