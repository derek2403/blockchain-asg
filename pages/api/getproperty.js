// pages/api/getproperty.js
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { JsonRpcProvider, Contract } from "ethers";
import { wrapEthersProvider } from "@oasisprotocol/sapphire-ethers-v6";

// --- Chain + Contract config ---
const RPC_URL = process.env.SAPPHIRE_TESTNET_RPC || "https://testnet.sapphire.oasis.io";
const CONTRACT_ADDRESS = "0x594794c9ba0BaEC3e9610a1652BF82BD5Bb89d52";
const ABI = [
  { anonymous: false, inputs: [{ indexed: true, internalType: "uint256", name: "id", type: "uint256" }], name: "Stored", type: "event" },
  { inputs: [{ internalType: "uint256", name: "id", type: "uint256" }], name: "get", outputs: [{ internalType: "string", name: "value", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "uint256", name: "id", type: "uint256" }, { internalType: "string", name: "value", type: "string" }], name: "store", outputs: [], stateMutability: "nonpayable", type: "function" },
];

// Convert 6-hex-digit ID to decimal string for on-chain lookups
function idDecFromHex6(idHex) {
  return BigInt("0x" + idHex).toString();
}

// AES-256-GCM decrypt (expects base64(iv|cipher|tag))
function decryptAesGcm(b64, keyB64) {
  if (!b64) return "";
  const key = Buffer.from(keyB64 || "", "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY_BASE64 must be base64 of 32 bytes");
  const buf = Buffer.from(b64, "base64");
  if (buf.length < 28) throw new Error("ciphertext too short");
  const iv = buf.slice(0, 12);
  const tag = buf.slice(buf.length - 16);
  const ciphertext = buf.slice(12, buf.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return dec.toString("utf8");
}

async function readIdObjects() {
  try {
    const filePath = path.join(process.cwd(), "data", "id.json");
    const raw = await fs.readFile(filePath, "utf8");
    let arr = JSON.parse(raw);
    if (!Array.isArray(arr)) arr = [];

    // Normalize: accept strings or objects
    const objs = arr.map((x) => {
      if (typeof x === "string") {
        return { idHex: x.toUpperCase(), images: [], housingValue: "", tokenAddress: "", owner: "" };
      }
      return {
        idHex: String(x?.idHex || x?.id || "").toUpperCase(),
        images: Array.isArray(x?.images) ? x.images : [],
        housingValue: typeof x?.housingValue === "string" || typeof x?.housingValue === "number" ? String(x.housingValue) : "",
        tokenAddress: typeof x?.tokenAddress === "string" ? x.tokenAddress : "",
        owner: typeof x?.owner === "string" ? x.owner : "",
      };
    });

    // Filter valid 6-hex + dedupe by idHex (prefer entries with hv/images/token)
    const score = (p) => {
      let s = 0;
      if (p.housingValue && Number(p.housingValue) > 0) s += 3;
      if (p.tokenAddress) s += 2;
      if (Array.isArray(p.images) && p.images.length) s += 1 + Math.min(2, p.images.length);
      return s;
    };
    const best = new Map();
    for (const o of objs) {
      if (!/^[0-9A-F]{6}$/.test(o.idHex)) continue;
      const prev = best.get(o.idHex);
      if (!prev || score(o) > score(prev)) best.set(o.idHex, o);
    }
    return Array.from(best.values());
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).send("Method not allowed");

    const entries = await readIdObjects();
    if (entries.length === 0) {
      return res.status(200).json({ properties: [] });
    }

    const baseProvider = new JsonRpcProvider(RPC_URL);
    const encProvider = wrapEthersProvider(baseProvider);
    const contract = new Contract(CONTRACT_ADDRESS, ABI, encProvider);

    const keyB64 = process.env.ENCRYPTION_KEY_BASE64 || "";

    const results = await Promise.all(
      entries.map(async (e) => {
        const idHex = e.idHex;
        const idDec = idDecFromHex6(idHex);
        let value = "";
        let plaintext = "";
        try {
          value = await contract.get(BigInt(idDec)); // base64 string saved on-chain
          try {
            plaintext = decryptAesGcm(value, keyB64);
          } catch {
            plaintext = "";
          }
        } catch {
          value = "";
          plaintext = "";
        }
        return {
          idHex,
          id: idDec,
          value,
          plaintext,
          images: e.images || [],
          housingValue: e.housingValue || "",
          tokenAddress: e.tokenAddress || "",
          owner: e.owner || "",
        };
      })
    );

    // Sort by idHex for stable UI
    results.sort((a, b) => (a.idHex > b.idHex ? 1 : -1));

    return res.status(200).json({ properties: results });
  } catch (err) {
    console.error("getproperty API error:", err);
    return res.status(500).send(err.message || "Server error");
  }
}