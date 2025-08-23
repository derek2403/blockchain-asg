// generate_key.js
// Prints a 32-byte AES key in base64 (for ENCRYPTION_KEY_BASE64)

import { randomBytes } from "crypto";
import fs from "fs";

const key = randomBytes(32); // 256-bit
const b64 = key.toString("base64");

const writeEnv = process.argv.includes("--write-env");
if (writeEnv) {
  const line = `ENCRYPTION_KEY_BASE64=${b64}\n`;
  try {
    if (fs.existsSync(".env")) {
      fs.appendFileSync(".env", line);
      console.log("Appended ENCRYPTION_KEY_BASE64 to .env");
    } else {
      fs.writeFileSync(".env", line);
      console.log("Created .env with ENCRYPTION_KEY_BASE64");
    }
  } catch (e) {
    console.error("Failed to write .env:", e.message);
  }
}

console.log("ENCRYPTION_KEY_BASE64 =", b64);