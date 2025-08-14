import formidable from "formidable";
import fs from "fs/promises";
import path from "path";

export const config = {
  api: { bodyParser: false }, // we handle multipart via formidable; JSON for PUT is fine (we’ll sniff method)
};

const ID_FILE = path.join(process.cwd(), "data", "id.json");
// Save under /img/<ID>/<filename>
const IMG_ROOT = path.join(process.cwd(), "img");

// -------------- helpers --------------
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

  // Normalize legacy shapes
  const norm = arr.map((x) => {
    if (typeof x === "string") {
      return { idHex: x.toUpperCase(), images: [], housingValue: "", tokenAddress: "" };
    }
    return {
      idHex: String(x?.idHex || x?.id || "").toUpperCase(),
      images: Array.isArray(x?.images) ? x.images : [],
      housingValue:
        typeof x?.housingValue === "string" || typeof x?.housingValue === "number"
          ? String(x.housingValue)
          : "",
      tokenAddress: typeof x?.tokenAddress === "string" ? x.tokenAddress : "",
    };
  });

  // Keep only valid ids
  return norm.filter((e) => /^[0-9A-F]{6}$/.test(e.idHex));
}

async function writeEntries(entries) {
  await fs.mkdir(path.dirname(ID_FILE), { recursive: true });
  await fs.writeFile(ID_FILE, JSON.stringify(entries, null, 2), "utf8");
}

function sanitizeFilename(name = "image") {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function parseForm(req) {
  const form = formidable({
    multiples: true,
    maxFiles: 3,
    keepExtensions: true,
  });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => (err ? reject(err) : resolve({ fields, files })));
  });
}

function isHexAddress(s = "") {
  return /^0x[0-9a-fA-F]{40}$/.test(s);
}

// -------------- handler --------------
export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const entries = await readEntries();
      return res.status(200).json({ properties: entries });
    }

    // Update tokenAddress only (client calls this after mint)
    if (req.method === "PUT") {
      const body = await new Promise((resolve, reject) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => {
          try {
            resolve(JSON.parse(data || "{}"));
          } catch (e) {
            reject(e);
          }
        });
      });

      const idHex = String(body.idHex || "").toUpperCase().trim();
      const tokenAddress = String(body.tokenAddress || "").trim();

      if (!/^[0-9A-F]{6}$/.test(idHex)) {
        return res.status(400).json({ error: "idHex must be 6 hex digits (e.g., A1B2C3)" });
      }
      if (!isHexAddress(tokenAddress)) {
        return res.status(400).json({ error: "tokenAddress must be a valid hex address" });
      }

      const entries = await readEntries();
      let entry = entries.find((e) => e.idHex === idHex);
      if (!entry) {
        // create minimal entry if not exists
        entry = { idHex, images: [], housingValue: "", tokenAddress };
        entries.push(entry);
      } else {
        entry.tokenAddress = tokenAddress;
      }
      await writeEntries(entries);
      return res.status(200).json({ ok: true, idHex, tokenAddress });
    }

    if (req.method === "POST") {
      const { fields, files } = await parseForm(req);

      const idHex = String(fields.idHex || "").toUpperCase().trim();
      if (!/^[0-9A-F]{6}$/.test(idHex)) {
        return res.status(400).json({ error: "idHex must be 6 hex digits (e.g., A1B2C3)" });
      }
      const housingValue = String(fields.housingValue || "").trim();

      // Collect up to 3 images
      let list = [];
      if (files.images) {
        list = Array.isArray(files.images) ? files.images : [files.images];
      }
      if (list.length > 3) list = list.slice(0, 3);

      // Read & normalize current entries
      const entries = await readEntries();
      let entry = entries.find((e) => e.idHex === idHex);
      if (!entry) {
        entry = { idHex, images: [], housingValue: "", tokenAddress: "" };
        entries.push(entry);
      }

      // Save images to /img/<ID>/<filename>
      await fs.mkdir(path.join(IMG_ROOT, idHex), { recursive: true });
      const savedPaths = [];

      for (const f of list) {
        const orig = sanitizeFilename(f.originalFilename || "image");
        const filename = `${Date.now()}_${orig}`;
        const destPath = path.join(IMG_ROOT, idHex, filename);
        await fs.copyFile(f.filepath, destPath);

        const rel = `/img/${idHex}/${filename}`;
        entry.images.push(rel);
        savedPaths.push(rel);
      }

      if (housingValue) entry.housingValue = housingValue;

      await writeEntries(entries);

      return res.status(200).json({
        ok: true,
        idHex,
        saved: savedPaths,
        housingValue: entry.housingValue,
        tokenAddress: entry.tokenAddress || "",
      });
    }

    return res.status(405).send("Method not allowed");
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message || "Server error");
  }
}