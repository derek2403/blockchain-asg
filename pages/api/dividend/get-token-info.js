// pages/api/dividend/get-token-info.js
import fs from "fs/promises";
import path from "path";
import { isAddress } from "ethers";

const ID_FILE = path.join(process.cwd(), "data", "id.json");

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).send("Method not allowed");
    }

    const id = String(req.query.id || "").trim().toUpperCase();
    if (!/^[0-9A-F]{6}$/.test(id)) {
      return res.status(400).send("Invalid id (expect 6 hex chars)");
    }

    // Read the id.json file
    let raw;
    try {
      raw = await fs.readFile(ID_FILE, "utf8");
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).send(`ID ${id} not found - data/id.json does not exist`);
      }
      throw err;
    }

    let arr;
    try { 
      arr = JSON.parse(raw); 
    } catch { 
      return res.status(500).send("Invalid JSON in data/id.json");
    }
    
    if (!Array.isArray(arr)) {
      return res.status(500).send("data/id.json must contain an array");
    }

    // Find the entry with the matching idHex and valid tokenAddress
    const entries = arr.filter(entry => {
      if (typeof entry !== "object" || !entry) return false;
      const idHex = String(entry.idHex || "").toUpperCase();
      const tokenAddress = entry.tokenAddress || "";
      return idHex === id && isAddress(tokenAddress);
    });

    if (entries.length === 0) {
      return res.status(404).send(`ID ${id} not found or has no valid tokenAddress`);
    }

    // If multiple entries, prefer the one with more complete data
    const bestEntry = entries.reduce((best, current) => {
      const bestScore = (best.housingValue ? 2 : 0) + (best.owner ? 1 : 0) + (Array.isArray(best.images) && best.images.length ? 1 : 0);
      const currentScore = (current.housingValue ? 2 : 0) + (current.owner ? 1 : 0) + (Array.isArray(current.images) && current.images.length ? 1 : 0);
      return currentScore > bestScore ? current : best;
    });

    return res.status(200).json({
      idHex: bestEntry.idHex.toUpperCase(),
      tokenAddress: bestEntry.tokenAddress,
      owner: bestEntry.owner || "",
      housingValue: bestEntry.housingValue || "0",
    });

  } catch (err) {
    console.error("API Error:", err);
    res.status(500).send(err.message || "Server error");
  }
}
