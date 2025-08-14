// pages/api/vault/resolve.js
import fs from "fs/promises";
import path from "path";
import { isAddress } from "ethers";

const ID_FILE = path.join(process.cwd(), "data", "id.json");

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).send("Method not allowed");

    const id = String(req.query.id || "").trim().toUpperCase();
    if (!/^[0-9A-F]{6}$/.test(id)) return res.status(400).send("Invalid id (expect 6 hex chars)");

    // Try to read the file, create empty array if it doesn't exist
    let raw;
    try {
      raw = await fs.readFile(ID_FILE, "utf8");
    } catch (err) {
      // If file doesn't exist, create directory and file
      if (err.code === 'ENOENT') {
        const dataDir = path.dirname(ID_FILE);
        try {
          await fs.mkdir(dataDir, { recursive: true });
        } catch (mkdirErr) {
          // Directory might already exist
        }
        raw = "[]";
      } else {
        throw err;
      }
    }

    let arr;
    try { 
      arr = JSON.parse(raw); 
    } catch { 
      arr = []; 
    }
    
    if (!Array.isArray(arr)) arr = [];

    // Normalize entries from your earlier schema
    const entries = arr.map((x) => {
      if (typeof x === "string") return { idHex: x.toUpperCase() };
      return {
        idHex: String(x?.idHex || x?.id || "").toUpperCase(),
        tokenAddress: x?.tokenAddress || "",
        owner: x?.owner || "",
        housingValue: typeof x?.housingValue === "string" || typeof x?.housingValue === "number" ? String(x.housingValue) : "",
      };
    });

    const found = entries.find((e) => e.idHex === id);
    if (!found) {
      return res.status(404).send(`ID ${id} not found in data/id.json`);
    }

    if (!isAddress(found.tokenAddress || "")) {
      return res.status(404).send(`ID ${id} found but tokenAddress is missing or invalid in data/id.json`);
    }

    return res.status(200).json({
      idHex: found.idHex,
      tokenAddress: found.tokenAddress,
      owner: isAddress(found.owner || "") ? found.owner : null, // optional
      housingValue: found.housingValue || "0",
    });
  } catch (err) {
    console.error("API Error:", err);
    res.status(500).send(err.message || "Server error");
  }
}