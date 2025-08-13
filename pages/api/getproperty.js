import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { JsonRpcProvider, Contract } from "ethers";
import { wrapEthersProvider } from "@oasisprotocol/sapphire-ethers-v6";

// --- Chain + Contract config ---
const RPC_URL = process.env.SAPPHIRE_TESTNET_RPC || "https://testnet.sapphire.oasis.io";
const CONTRACT_ADDRESS = "0x594794c9ba0BaEC3e9610a1652BF82BD5Bb89d52";
const ABI = [
  {
    anonymous: false,
    inputs: [{ indexed: true, internalType: "uint256", name: "id", type: "uint256" }],
    name: "Stored",
    type: "event",
  },
  {
    inputs: [{ internalType: "uint256", name: "id", type: "uint256" }],
    name: "get",
    outputs: [{ internalType: "string", name: "value", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "id", type: "uint256" },
      { internalType: "string", name: "value", type: "string" },
    ],
    name: "store",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// Convert 6-hex-digit ID to decimal string for on-chain lookups
function idDecFromHex6(idHex) {
  return BigInt("0x" + idHex).toString();
}

async function readIds() {
  try {
    const filePath = path.join(process.cwd(), "data", "id.json");
    const raw = await fs.readFile(filePath, "utf8");
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // Keep only 6-hex-digit entries
    return arr
      .map((s) => String(s || "").toUpperCase().trim())
      .filter((s) => /^[0-9A-F]{6}$/.test(s));
  } catch {
    return []; // no file yet
  }
}

// AES-256-GCM decrypt (expects base64(iv|cipher|tag))
function decryptAesGcm(b64, keyB64) {
  if (!b64) return "";
  const key = Buffer.from(keyB64 || "", "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY_BASE64 must be base64 of 32 bytes");
  const buf = Buffer.from(b64, "base64");
  if (buf.length < 12 + 16) throw new Error("ciphertext too short");
  const iv = buf.slice(0, 12);
  const tag = buf.slice(buf.length - 16);
  const ciphertext = buf.slice(12, buf.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return dec.toString("utf8");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).send("Method not allowed");

    const idHexList = await readIds();
    if (idHexList.length === 0) {
      return res.status(200).json({ properties: [] });
    }

    const baseProvider = new JsonRpcProvider(RPC_URL);
    const encProvider = wrapEthersProvider(baseProvider);
    const contract = new Contract(CONTRACT_ADDRESS, ABI, encProvider);

    const keyB64 = process.env.ENCRYPTION_KEY_BASE64 || "";

    const results = await Promise.all(
      idHexList.map(async (idHex) => {
        const idDec = idDecFromHex6(idHex);
        let value = "";
        let plaintext = "";
        try {
          value = await contract.get(BigInt(idDec));
          try {
            plaintext = decryptAesGcm(value, keyB64);
          } catch (decErr) {
            plaintext = ""; // keep going even if decrypt fails
          }
        } catch (e) {
          value = "";
          plaintext = "";
        }
        return { idHex, id: idDec, value, plaintext };
      })
    );

    return res.status(200).json({ properties: results });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || "Server error");
  }
}