import formidable from "formidable";
import fs from "fs/promises";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import crypto from "crypto";

export const config = {
  api: { bodyParser: false }, // Handle multipart and JSON manually
};

const ID_FILE = path.join(process.cwd(), "data", "id.json");
const IMG_ROOT = path.join(process.cwd(), "img");

// ---------- Utility Functions ----------
function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

// AES-256-GCM encrypt -> base64(iv|cipher|tag)
function encryptAesGcm(plaintext, keyB64) {
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY_BASE64 must be a base64-encoded 32-byte key");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString("base64");
}

// Generate 6-hex-digit ID from plaintext (deterministic)
// (Kept for reference; not used for final ID generation anymore)
function id6HexFromPlaintext(plaintext) {
  const hashHex = crypto.createHash("sha256").update(plaintext, "utf8").digest("hex");
  return hashHex.slice(0, 6).toUpperCase().padStart(6, "0");
}

// NEW: Generate a **unique** 6-hex ID (salted + collision-checked)
async function generateUniqueIdHex(plaintext) {
  const existing = new Set((await readEntries()).map((e) => e.idHex));

  // Try salted-hash candidates tied to the deed data (50 attempts)
  for (let i = 0; i < 50; i++) {
    const salt = crypto.randomBytes(8).toString("hex"); // 64 bits randomness
    const hashHex = crypto.createHash("sha256").update(`${plaintext}:${salt}`, "utf8").digest("hex");
    const candidate = hashHex.slice(0, 6).toUpperCase();
    if (!existing.has(candidate)) return candidate;
  }

  // Fallback: random 24-bit (100 attempts)
  for (let i = 0; i < 100; i++) {
    const candidate = crypto.randomBytes(3).toString("hex").toUpperCase();
    if (!existing.has(candidate)) return candidate;
  }

  throw new Error("Could not generate unique idHex");
}

// Convert 6-hex-digit to decimal string for on-chain
function idDecFromHex6(idHex) {
  return BigInt("0x" + idHex).toString();
}

// Parse multipart form data
async function parseForm(req) {
  const form = formidable({ 
    multiples: true, 
    maxFiles: 4, // 1 deed + up to 3 property images
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024 // 10MB
  });
  return await new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => (err ? reject(err) : resolve({ fields, files })));
  });
}

// Parse JSON body
async function readJsonBody(req) {
  const raw = await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
  return raw ? JSON.parse(raw) : {};
}

// Clean up JSON response from Gemini (remove code fences, etc.)
function tryParseJsonLoose(text) {
  if (!text) return null;
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(s);
  } catch {}
  
  // Try to find JSON object in text
  const start = s.indexOf("{");
  if (start >= 0) {
    let depth = 0;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = s.slice(start, i + 1);
          try {
            return JSON.parse(candidate);
          } catch {}
          break;
        }
      }
    }
  }
  return null;
}

// Fallback extraction using regex if AI doesn't return JSON
function fallbackExtract(text) {
  const pick = (labelRegex) => {
    const m = text.match(labelRegex);
    return (m && (m[1] || m[2] || m[0]).trim()) || "";
  };
  return {
    NoHakmilik: pick(/No\.?\s*Hakmilik\s*[:\-]\s*([^\n]+)/i) || pick(/Geran\s+\d+/i),
    NoBangunan: pick(/No\.?\s*Bangunan\s*[:\-]\s*([^\n]+)/i),
    NoTingkat: pick(/No\.?\s*Tingkat\s*[:\-]\s*([^\n]+)/i),
    NoPetak: pick(/No\.?\s*Petak\s*[:\-]\s*([^\n]+)/i),
    Negeri: pick(/Negeri\s*[:\-]\s*([^\n]+)/i),
    Daerah: pick(/Daerah\s*[:\-]\s*([^\n]+)/i),
    Bandar: pick(/Bandar(?:\/Pekan\/Mukim)?\s*[:\-]\s*([^\n]+)/i),
  };
}

// ---------- ID Management Functions ----------
async function ensureIdFile() {
  try {
    await fs.access(ID_FILE);
  } catch {
    await fs.mkdir(path.dirname(ID_FILE), { recursive: true });
    await fs.writeFile(ID_FILE, "[]", "utf8");
  }
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

  // Normalize entries to ensure consistent format
  const norm = arr.map((x) => {
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

  return norm.filter((e) => /^[0-9A-F]{6}$/.test(e.idHex));
}

async function writeEntries(entries) {
  await fs.mkdir(path.dirname(ID_FILE), { recursive: true });
  await fs.writeFile(ID_FILE, JSON.stringify(entries, null, 2), "utf8");
}

async function saveIdHex(idHex, owner = "") {
  const entries = await readEntries();
  let entry = entries.find((e) => e.idHex === idHex);
  if (!entry) {
    entry = { idHex, images: [], housingValue: "", tokenAddress: "", owner };
    entries.push(entry);
  }
  if (owner) entry.owner = owner;
  await writeEntries(entries);
}

// ---------- Image Management Functions ----------
function sanitizeFilename(name = "image") {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isHexAddress(s = "") {
  return /^0x[0-9a-fA-F]{40}$/.test(s);
}

// ---------- Main Handler ----------
export default async function handler(req, res) {
  try {
    const action = req.headers["x-action"];

    // Handle deed parsing (Step 1)
    if (req.method === "POST" && action === "parse-deed") {
      const { fields, files } = await parseForm(req);
      const owner = String(fields.owner || "").trim();
      if (!owner) return res.status(400).send("Owner wallet address is required");

      const file = files.image;
      if (!file) return res.status(400).send("Land deed image is required");

      const filepath = Array.isArray(file) ? file[0].filepath : file.filepath;
      const mimetype = Array.isArray(file) ? file[0].mimetype : file.mimetype || "image/jpeg";
      const buffer = await fs.readFile(filepath);
      const b64 = buffer.toString("base64");

      // Process with Gemini AI
      const genAI = new GoogleGenerativeAI(requireEnv("GEMINI_API_KEY"));
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              NoHakmilik: { type: "string" },
              NoBangunan: { type: "string" },
              NoTingkat: { type: "string" },
              NoPetak: { type: "string" },
              Negeri: { type: "string" },
              Daerah: { type: "string" },
              Bandar: { type: "string" },
            },
            required: ["NoHakmilik", "NoBangunan", "NoTingkat", "NoPetak", "Negeri", "Daerah", "Bandar"],
          },
        },
      });

      const prompt = `
Extract fields from the attached Malaysian "Akta Hakmilik Strata" deed scan and return ONLY JSON.
Keys (exact spelling):
- NoHakmilik
- NoBangunan
- NoTingkat
- NoPetak
- Negeri
- Daerah
- Bandar (if the document shows "BANDAR/PEKAN/MUKIM", return the BANDAR value)

Rules:
- Output must be valid JSON with exactly these keys.
- Preserve capitalization and numbers exactly as seen.
- If a field is missing, return an empty string.
`;

      const result = await model.generateContent({
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mimetype, data: b64 } },
          ],
        }],
      });

      // Parse AI response
      let parsed = null;
      let rawText = "";
      try {
        rawText = result.response?.text() ?? "";
        parsed = tryParseJsonLoose(rawText);
      } catch {
        parsed = null;
      }

      // Fallback extraction if JSON parsing fails
      if (!parsed) {
        parsed = fallbackExtract(rawText || "");
      }

      // Normalize extracted data
      const noHakmilik = (parsed.NoHakmilik || "").trim();
      const noBangunan = (parsed.NoBangunan || "").trim();
      const noTingkat = (parsed.NoTingkat || "").trim();
      const noPetak = (parsed.NoPetak || "").trim();
      const negeri = (parsed.Negeri || "").trim();
      const daerah = (parsed.Daerah || "").trim();
      let bandar = (parsed.Bandar || "").trim();

      // Clean up bandar field if it contains multiple values
      if (bandar && /\/|,/.test(bandar)) {
        const parts = bandar.split(/[\/,]/).map((x) => x.trim());
        const prefer = parts.find((p) => /bandar/i.test(p));
        if (prefer) bandar = prefer;
      }

      // Create plaintext for encryption
      const plaintext = [
        noHakmilik,
        noBangunan,
        noTingkat,
        noPetak,
        `${negeri}.${daerah}`,
        bandar,
        owner,
      ].join(",");

      // Encrypt data
      const encrypted = encryptAesGcm(plaintext, requireEnv("ENCRYPTION_KEY_BASE64"));

      // === CHANGED: generate a **unique** 6-hex id ===
      const idHex = await generateUniqueIdHex(plaintext);
      const id = idDecFromHex6(idHex);

      return res.status(200).json({
        id,       // decimal for blockchain
        idHex,    // hex for display
        encrypted,
        fields: {
          NoHakmilik: noHakmilik,
          NoBangunan: noBangunan,
          NoTingkat: noTingkat,
          NoPetak: noPetak,
          Negeri: negeri,
          Daerah: daerah,
          Bandar: bandar,
          Owner: owner,
        },
      });
    }

    // Handle ID saving (Step 1 completion)
    if (req.method === "POST" && action === "save-id") {
      const body = await readJsonBody(req);
      const idHex = String(body.idHex || "").toUpperCase().trim();
      const owner = String(body.owner || "").trim();

      if (!/^[0-9A-F]{6}$/.test(idHex)) {
        return res.status(400).json({ error: "idHex must be 6 hex digits (e.g., A1B2C3)" });
      }

      await saveIdHex(idHex, owner);
      return res.status(200).json({ ok: true });
    }

    // Handle image upload (Step 2)
    if (req.method === "POST" && action === "upload-images") {
      const { fields, files } = await parseForm(req);

      const idHex = String(fields.idHex || "").toUpperCase().trim();
      if (!/^[0-9A-F]{6}$/.test(idHex)) {
        return res.status(400).json({ error: "idHex must be 6 hex digits (e.g., A1B2C3)" });
      }

      const housingValue = String(fields.housingValue || "").trim();
      const owner = String(fields.owner || "").trim();

      // Collect up to 3 images
      let imageList = [];
      if (files.images) {
        imageList = Array.isArray(files.images) ? files.images : [files.images];
      }
      if (imageList.length > 3) imageList = imageList.slice(0, 3);

      // Read current entries
      const entries = await readEntries();
      let entry = entries.find((e) => e.idHex === idHex);
      if (!entry) {
        entry = { idHex, images: [], housingValue: "", tokenAddress: "", owner: "" };
        entries.push(entry);
      }

      // Save images to /img/<ID>/<filename>
      await fs.mkdir(path.join(IMG_ROOT, idHex), { recursive: true });
      const savedPaths = [];
      for (const f of imageList) {
        const orig = sanitizeFilename(f.originalFilename || "image");
        const filename = `${Date.now()}_${orig}`;
        const destPath = path.join(IMG_ROOT, idHex, filename);
        await fs.copyFile(f.filepath, destPath);
        const rel = `/img/${idHex}/${filename}`;
        entry.images.push(rel);
        savedPaths.push(rel);
      }

      // Update entry
      if (housingValue) entry.housingValue = housingValue;
      if (owner) entry.owner = owner;

      await writeEntries(entries);

      return res.status(200).json({
        ok: true,
        idHex,
        saved: savedPaths,
        housingValue: entry.housingValue,
        tokenAddress: entry.tokenAddress || "",
        owner: entry.owner || "",
      });
    }

    // Handle token address saving (Step 2 completion)
    if (req.method === "POST" && action === "save-token") {
      const body = await readJsonBody(req);
      const idHex = String(body.idHex || "").toUpperCase().trim();
      const tokenAddress = String(body.tokenAddress || "").trim();
      const owner = String(body.owner || "").trim();

      if (!/^[0-9A-F]{6}$/.test(idHex)) {
        return res.status(400).json({ error: "idHex must be 6 hex digits (e.g., A1B2C3)" });
      }
      if (tokenAddress && !isHexAddress(tokenAddress)) {
        return res.status(400).json({ error: "tokenAddress must be a valid hex address" });
      }

      const entries = await readEntries();
      let entry = entries.find((e) => e.idHex === idHex);
      if (!entry) {
        entry = { idHex, images: [], housingValue: "", tokenAddress: "", owner: "" };
        entries.push(entry);
      }
      if (tokenAddress) entry.tokenAddress = tokenAddress;
      if (owner) entry.owner = owner;

      await writeEntries(entries);
      return res.status(200).json({ ok: true, idHex, tokenAddress: entry.tokenAddress, owner: entry.owner });
    }

    // GET: Return all properties
    if (req.method === "GET") {
      const entries = await readEntries();
      return res.status(200).json({ properties: entries });
    }

    return res.status(405).send("Method not allowed");
  } catch (err) {
    console.error("API Error:", err);
    return res.status(500).send(err.message || "Server error");
  }
}