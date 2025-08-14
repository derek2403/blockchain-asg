// pages/menu.js
import { useEffect, useMemo, useState } from "react";

/** ---------- helpers ---------- */
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
function tokensPerTESTFromHV(hv) {
  const n = Number(hv);
  if (!Number.isFinite(n) || n <= 0) return null;
  return 1_000_000 / n;
}

export default function MenuPage() {
  const [loading, setLoading] = useState(true);
  const [propsData, setPropsData] = useState([]);
  const [error, setError] = useState("");

  // modal
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/getproperty");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const list = Array.isArray(data?.properties) ? data.properties : [];
      setPropsData(list);
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

  const styled = {
    page: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: "40px 16px",
    },
    wrap: { maxWidth: 1100, margin: "0 auto" },
    title: { margin: 0, fontSize: 28, fontWeight: 700, color: "#111827" },
    sub: { margin: "6px 0 18px", color: "#6b7280" },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 },
    card: {
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: "0 10px 24px rgba(0,0,0,.06)",
      cursor: "pointer",
      transition: "transform .15s ease, box-shadow .15s ease",
    },
    cover: { width: "100%", height: 160, objectFit: "cover", display: "block", background: "#f3f4f6" },
    cardBody: { padding: 14 },
    id: { fontWeight: 700, color: "#111827", fontSize: 16 },
    price: { marginTop: 6, color: "#4b5563", fontSize: 14 },
    // modal
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 },
    modal: { width: "min(720px, 96vw)", background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 24px 64px rgba(0,0,0,.25)", overflow: "hidden" },
    modalHead: { padding: "16px 18px", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" },
    modalBody: { padding: 18, color: "#111827" },
    pill: { background: "#eef2ff", color: "#4338ca", fontSize: 12, padding: "4px 8px", borderRadius: 999, marginLeft: 8 },
    fieldGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginTop: 10 },
    field: { fontSize: 14 },
    label: { fontWeight: 600, color: "#374151" },
    closeBtn: { border: 0, background: "transparent", color: "white", fontWeight: 700, fontSize: 18, cursor: "pointer" },
    refreshBtn: { background: "#111827", color: "white", border: 0, padding: "8px 14px", borderRadius: 8, fontWeight: 600, cursor: "pointer", marginBottom: 12 },
    status: { marginTop: 8, color: "#dc2626", fontWeight: 600 },
  };

  function openModal(p) {
    setActive(p);
    setOpen(true);
  }

  const activeParsed = useMemo(() => {
    if (!active) return null;
    const fields = parsePlaintext(active.plaintext) || {};
    if (!fields.owner && active.owner) fields.owner = active.owner; // fallback to id.json owner
    return fields;
  }, [active]);

  return (
    <div style={styled.page}>
      <div style={styled.wrap}>
        <h1 style={styled.title}>Property Marketplace</h1>
        <p style={styled.sub}>Browse tokenized properties. Click a card to see full details.</p>

        <button onClick={load} disabled={loading} style={styled.refreshBtn}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>

        {error && <div style={styled.status}>{error}</div>}
        {!loading && !error && propsData.length === 0 && <p>No properties found yet.</p>}

        <div style={styled.grid}>
          {propsData.map((p) => {
            const id = (p.idHex || "").toUpperCase();
            const tpt = tokensPerTESTFromHV(p.housingValue);
            const displayPrice = tpt == null ? "—" : Number(tpt).toFixed(6);
            const img =
              (Array.isArray(p.images) && p.images[0]) ||
              "data:image/svg+xml;charset=utf-8," +
                encodeURIComponent(
                  `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='360'><rect width='100%' height='100%' fill='#f3f4f6'/><text x='50%' y='50%' fill='#9ca3af' font-family='Inter,system-ui' font-size='20' text-anchor='middle' dominant-baseline='middle'>No image</text></svg>`
                );

            return (
              <article
                key={id + (p.tokenAddress || "")}
                onClick={() => openModal(p)}
                style={styled.card}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt={`${id} cover`} style={styled.cover} />
                <div style={styled.cardBody}>
                  <div style={styled.id}>{id}</div>
                  <div style={styled.price}>
                    <b>{id}/TEST:</b> {displayPrice}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* MODAL */}
        {open && active && (
          <div style={styled.overlay} onClick={() => setOpen(false)}>
            <div
              style={styled.modal}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="prop-title"
            >
              <header style={styled.modalHead}>
                <div id="prop-title" style={{ display: "flex", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: 18 }}>
                    {active.idHex?.toUpperCase()}
                  </span>
                  <span style={styled.pill}>
                    {tokensPerTESTFromHV(active.housingValue) == null
                      ? "No price"
                      : `${Number(tokensPerTESTFromHV(active.housingValue)).toFixed(6)} / TEST`}
                  </span>
                </div>
                <button style={styled.closeBtn} onClick={() => setOpen(false)} aria-label="Close">
                  ×
                </button>
              </header>
              <div style={styled.modalBody}>
                {/* images */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {(Array.isArray(active.images) && active.images.length ? active.images : [null])
                    .slice(0, 3)
                    .map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={
                          src ||
                          "data:image/svg+xml;charset=utf-8," +
                            encodeURIComponent(
                              `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='260'><rect width='100%' height='100%' fill='#f3f4f6'/><text x='50%' y='50%' fill='#9ca3af' font-family='Inter,system-ui' font-size='16' text-anchor='middle' dominant-baseline='middle'>No image</text></svg>`
                            )
                        }
                        alt="property"
                        style={{
                          width: 220,
                          height: 140,
                          objectFit: "cover",
                          borderRadius: 12,
                          border: "1px solid #e5e7eb",
                          background: "#f9fafb",
                        }}
                      />
                    ))}
                </div>

                {/* details */}
                <div style={styled.fieldGrid}>
                  <div style={styled.field}>
                    <div style={styled.label}>No. Hakmilik</div>
                    <div>{activeParsed?.noHakmilik || ""}</div>
                  </div>
                  <div style={styled.field}>
                    <div style={styled.label}>No. Bangunan</div>
                    <div>{activeParsed?.noBangunan || ""}</div>
                  </div>
                  <div style={styled.field}>
                    <div style={styled.label}>No. Tingkat</div>
                    <div>{activeParsed?.noTingkat || ""}</div>
                  </div>
                  <div style={styled.field}>
                    <div style={styled.label}>No. Petak</div>
                    <div>{activeParsed?.noPetak || ""}</div>
                  </div>
                  <div style={styled.field}>
                    <div style={styled.label}>Negeri</div>
                    <div>{activeParsed?.negeri || ""}</div>
                  </div>
                  <div style={styled.field}>
                    <div style={styled.label}>Daerah</div>
                    <div>{activeParsed?.daerah || ""}</div>
                  </div>
                  <div style={styled.field}>
                    <div style={styled.label}>Bandar</div>
                    <div>{activeParsed?.bandar || ""}</div>
                  </div>
                  <div style={{ ...styled.field, gridColumn: "1 / -1" }}>
                    <div style={styled.label}>Owner</div>
                    <div style={{ wordBreak: "break-all" }}>{activeParsed?.owner || ""}</div>
                  </div>
                </div>

                <div style={{ marginTop: 14, fontSize: 13, color: "#6b7280" }}>
                  {active.tokenAddress && (
                    <>
                      Token:{" "}
                      <a
                        href={`https://explorer.oasis.io/testnet/sapphire/address/${active.tokenAddress}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#4f46e5", textDecoration: "none" }}
                      >
                        {active.tokenAddress}
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        article:hover {
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.12) !important;
        }
      `}</style>
    </div>
  );
}