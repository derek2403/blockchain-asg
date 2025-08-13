import formidable from "formidable";
import fs from "fs/promises";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import crypto from "crypto";

export const config = {
  api: { bodyParser: false }, // We parse multipart manually; JSON mode handled below
};

// ---------- utils ----------
function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
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

// 6-hex-digit ID from plaintext (deterministic)
function id6HexFromPlaintext(plaintext) {
  const hashHex = crypto.createHash("sha256").update(plaintext, "utf8").digest("hex");
  // Take first 6 hex chars; ensure uppercase & zero-padded to 6
  return hashHex.slice(0, 6).toUpperCase().padStart(6, "0");
}

// Decimal string for on-chain from 6-hex-digit
function idDecFromHex6(idHex) {
  return BigInt("0x" + idHex).toString();
}

async function parseForm(req) {
  const form = formidable({ multiples: false, maxFiles: 1, keepExtensions: false });
  return await new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => (err ? reject(err) : resolve({ fields, files })));
  });
}

async function readJsonBody(req) {
  const raw = await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
  return raw ? JSON.parse(raw) : {};
}

// Remove code fences and try to parse strict JSON
function tryParseJsonLoose(text) {
  if (!text) return null;
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(s);
  } catch {}
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

// Last-resort: pull keys with regex if model returns plain text lines
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

// ---- persist ID (hex) to data/id.json ----
async function saveIdHex(idHex) {
  const dir = path.join(process.cwd(), "data");
  const filePath = path.join(dir, "id.json");
  await fs.mkdir(dir, { recursive: true });
  let arr = [];
  try {
    const existing = await fs.readFile(filePath, "utf8");
    arr = JSON.parse(existing);
    if (!Array.isArray(arr)) arr = [];
  } catch {
    arr = [];
  }
  if (!arr.includes(idHex)) arr.push(idHex);
  await fs.writeFile(filePath, JSON.stringify(arr, null, 2), "utf8");
}

// ---------- handler ----------
export default async function handler(req, res) {
  try {
    // Mode B: saveId (JSON)
    if (req.method === "POST" && (req.headers["content-type"] || "").includes("application/json")) {
      const body = await readJsonBody(req);
      if (!body?.saveId || typeof body.idHex !== "string") {
        return res.status(400).json({ error: "Expected { saveId: true, idHex: 'A1B2C3' }" });
      }
      const idHex = body.idHex.toUpperCase();
      if (!/^[0-9A-F]{6}$/.test(idHex)) {
        return res.status(400).json({ error: "idHex must be 6 hex digits (e.g., A1B2C3)" });
      }
      await saveIdHex(idHex);
      return res.status(200).json({ ok: true });
    }

    // Mode A: parse + encrypt (multipart)
    if (req.method !== "POST") return res.status(405).send("Method not allowed");

    const { fields, files } = await parseForm(req);
    const owner = String(fields.owner || "").trim();
    if (!owner) return res.status(400).send("owner is required");

    const file = files.image;
    if (!file) return res.status(400).send("image is required");

    const filepath = Array.isArray(file) ? file[0].filepath : file.filepath;
    const mimetype = Array.isArray(file) ? file[0].mimetype : file.mimetype || "image/jpeg";
    const buffer = await fs.readFile(filepath);
    const b64 = buffer.toString("base64");

    const genAI = new GoogleGenerativeAI(requireEnv("GEMINI_API_KEY"));

    // Ask for JSON deterministically using responseMimeType + schema
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
          required: [
            "NoHakmilik",
            "NoBangunan",
            "NoTingkat",
            "NoPetak",
            "Negeri",
            "Daerah",
            "Bandar",
          ],
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
- Bandar  (if the document shows "BANDAR/PEKAN/MUKIM", return the BANDAR value)

Rules:
- Output must be valid JSON with exactly these keys.
- Preserve capitalization and numbers exactly as seen.
- If a field is missing, return an empty string.
`;

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mimetype, data: b64 } },
          ],
        },
      ],
    });

    // Try strict JSON first
    let parsed = null;
    let rawText = "";
    try {
      rawText = result.response?.text() ?? "";
      parsed = tryParseJsonLoose(rawText);
    } catch {
      parsed = null;
    }

    // Fallback: regex extraction
    if (!parsed) {
      parsed = fallbackExtract(rawText || "");
    }

    // Normalize & build plaintext in the required sequence
    const noHakmilik = (parsed.NoHakmilik || "").trim();
    const noBangunan = (parsed.NoBangunan || "").trim();
    const noTingkat = (parsed.NoTingkat || "").trim();
    const noPetak = (parsed.NoPetak || "").trim();
    const negeri = (parsed.Negeri || "").trim();
    const daerah = (parsed.Daerah || "").trim();
    let bandar = (parsed.Bandar || "").trim();

    if (bandar && /\/|,/.test(bandar)) {
      const parts = bandar.split(/[\/,]/).map((x) => x.trim());
      const prefer = parts.find((p) => /bandar/i.test(p));
      if (prefer) bandar = prefer;
    }

    const plaintext = [
      noHakmilik,
      noBangunan,
      noTingkat,
      noPetak,
      `${negeri}.${daerah}`,
      bandar,
      owner,
    ].join(",");

    const encrypted = encryptAesGcm(plaintext, requireEnv("ENCRYPTION_KEY_BASE64"));

    // 6-hex-digit ID + decimal for on-chain
    const idHex = id6HexFromPlaintext(plaintext);
    const id = idDecFromHex6(idHex);

    return res.status(200).json({
      id,       // decimal for uint256 on-chain
      idHex,    // 6-hex-digit (display & saving)
      encrypted,
      plaintext, // remove in prod if sensitive
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
      _modelText: rawText, // dev aid
    });
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message || "Server error");
  }
}