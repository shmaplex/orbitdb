// test/sync/fixtures/test-keys-path.ts
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testKeysPath = path.join(__dirname, "keys");

export default testKeysPath;
