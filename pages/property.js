import { useEffect, useState } from "react";

function parsePlaintext(s) {
  if (!s) return null;
  const parts = s.split(",");
  if (parts.length < 7) return null;
  const [noHakmilik, noBangunan, noTingkat, noPetak, negeriDaerah, bandar, owner] = parts;
  const [negeri, daerah] = String(negeriDaerah || "").split(".");
  return {
    noHakmilik: noHakmilik || "",
    noBangunan: noBangunan || "",
    noTingkat: noTingkat || "",
    noPetak: noPetak || "",
    negeri: negeri || "",
    daerah: daerah || "",
    bandar: bandar || "",
    owner: owner || "",
  };
}

export default function PropertyListPage() {
  const [loading, setLoading] = useState(true);
  const [propsData, setPropsData] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/getproperty");
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to fetch properties");
      }
      const data = await res.json();
      setPropsData(Array.isArray(data?.properties) ? data.properties : []);
    } catch (e) {
      console.error(e);
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <main style={{ maxWidth: 880, margin: "40px auto", padding: 24, fontFamily: "system-ui" }}>
      <h1>All Properties</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Loaded from <code>data/id.json</code> and resolved on-chain from Sapphire Testnet.
      </p>

      <div style={{ margin: "12px 0" }}>
        <button onClick={load} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <p style={{ color: "crimson" }}>
          <strong>Error:</strong> {error}
        </p>
      )}

      {!loading && !error && propsData.length === 0 && <p>No properties found yet.</p>}

      <div style={{ display: "grid", gap: 12 }}>
        {propsData.map((p) => {
          const fields = parsePlaintext(p.plaintext);
          return (
            <div
              key={p.idHex}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 16,
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div><strong>ID (hex):</strong> {p.idHex}</div>
                <div><strong>ID (dec):</strong> {p.id}</div>
              </div>

              <div style={{ marginTop: 8 }}>
                <strong>Decrypted (plaintext):</strong>{" "}
                {p.plaintext ? p.plaintext : <em>(failed to decrypt)</em>}
              </div>

              <details style={{ marginTop: 8 }}>
                <summary>Encrypted (base64)</summary>
                <div style={{ wordBreak: "break-all" }}>{p.value || "(empty)"}</div>
              </details>

              {fields && (
                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
                  <div><strong>No. Hakmilik</strong><div>{fields.noHakmilik}</div></div>
                  <div><strong>No. Bangunan</strong><div>{fields.noBangunan}</div></div>
                  <div><strong>No. Tingkat</strong><div>{fields.noTingkat}</div></div>
                  <div><strong>No. Petak</strong><div>{fields.noPetak}</div></div>
                  <div><strong>Negeri</strong><div>{fields.negeri}</div></div>
                  <div><strong>Daerah</strong><div>{fields.daerah}</div></div>
                  <div><strong>Bandar</strong><div>{fields.bandar}</div></div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <strong>Owner</strong><div style={{ wordBreak: "break-all" }}>{fields.owner}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}