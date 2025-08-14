// pages/api/price.js
import fs from "fs/promises";
import path from "path";

const ID_FILE = path.join(process.cwd(), "data", "id.json");

async function ensureIdFile() {
  try {
    await fs.access(ID_FILE);
  } catch {
    await fs.mkdir(path.dirname(ID_FILE), { recursive: true });
    await fs.writeFile(ID_FILE, "[]", "utf8");
  }
}

function normEntry(x = {}) {
  // Normalize legacy structures and preserve fields we know about.
  const idHex = String(x?.idHex || x?.id || "").toUpperCase();
  const images = Array.isArray(x?.images) ? x.images : [];
  const housingValue =
    typeof x?.housingValue === "number" || typeof x?.housingValue === "string"
      ? String(x.housingValue)
      : "";
  const tokenAddress =
    typeof x?.tokenAddress === "string" ? x.tokenAddress : "";
  const owner = typeof x?.owner === "string" ? x.owner : "";

  return { idHex, images, housingValue, tokenAddress, owner };
}

async function readEntries() {
  await ensureIdFile();
  const raw = await fs.readFile(ID_FILE, "utf8");
  let arr;
  try {
    arr = JSON.parse(raw);
  } catch {
    arr = [];
  }
  if (!Array.isArray(arr)) arr = [];
  const norm = arr.map(normEntry);
  return norm.filter((e) => /^[0-9A-F]{6}$/.test(e.idHex));
}

async function writeEntries(entries) {
  await fs.mkdir(path.dirname(ID_FILE), { recursive: true });
  await fs.writeFile(ID_FILE, JSON.stringify(entries, null, 2), "utf8");
}

function formatPricePerTokenTEST(housingValueStr) {
  // price(TEST) = housingValue / 1_000_000 (per 1 token)
  // produce a human string (trim trailing zeros)
  const hv = BigInt(housingValueStr || "0");
  const denom = 1_000_000n;

  const whole = hv / denom;           // integer part
  const frac = hv % denom;            // 0..999999
  let fracStr = frac.toString().padStart(6, "0"); // 6 decimal places
  // trim trailing zeros
  fracStr = fracStr.replace(/0+$/, "");
  return fracStr.length ? `${whole.toString()}.${fracStr}` : whole.toString();
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const entries = await readEntries();
      const id = String(req.query?.id || "").toUpperCase();

      if (id) {
        const e = entries.find((x) => x.idHex === id);
        if (!e) return res.status(404).send("ID not found in data/id.json");
        const pricePerTokenTEST = formatPricePerTokenTEST(e.housingValue || "0");
        return res.status(200).json({ ...e, pricePerTokenTEST });
      }

      // List all with computed prices
      const properties = entries.map((e) => ({
        ...e,
        pricePerTokenTEST: formatPricePerTokenTEST(e.housingValue || "0"),
      }));
      return res.status(200).json({ properties });
    }

    if (req.method === "POST") {
      const { idHex, housingValue } = req.body || {};
      const id = String(idHex || "").toUpperCase().trim();
      if (!/^[0-9A-F]{6}$/.test(id)) {
        return res.status(400).send("idHex must be 6 hex digits (e.g., A1B2C3)");
      }
      const hvStr = String(housingValue ?? "").trim();
      if (!/^\d+$/.test(hvStr)) {
        return res.status(400).send("housingValue must be an integer string (e.g., 650000)");
      }

      const entries = await readEntries();
      let entry = entries.find((x) => x.idHex === id);
      if (!entry) {
        // Create a new entry with minimal fields
        entry = { idHex: id, images: [], housingValue: "0", tokenAddress: "", owner: "" };
        entries.push(entry);
      }

      entry.housingValue = hvStr;

      await writeEntries(entries);

      const pricePerTokenTEST = formatPricePerTokenTEST(entry.housingValue);
      return res.status(200).json({ ...entry, pricePerTokenTEST });
    }

    return res.status(405).send("Method not allowed");
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || "Server error");
  }
}