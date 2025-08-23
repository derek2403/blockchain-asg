// pages/menu.js
import { useEffect, useMemo, useState } from "react";
import {
  BrowserProvider,
  Contract,
  formatUnits,
  isAddress,
} from "ethers";

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

/** ---------- blockchain config ---------- */
const SAPPHIRE_TESTNET = {
  chainId: "0x5aff", // 23295
  chainName: "Oasis Sapphire Testnet",
  nativeCurrency: { name: "Sapphire Test ROSE", symbol: "TEST", decimals: 18 },
  rpcUrls: ["https://testnet.sapphire.oasis.io"],
  blockExplorerUrls: ["https://explorer.oasis.io/testnet/sapphire"],
};

const VAULT_ADDRESS = "0xe7533E80B13e34092873257Af615A0A72a3A8367";

const VAULT_ABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "token",
        type: "address"
      }
    ],
    name: "getListing",
    outputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address"
      },
      {
        internalType: "uint8",
        name: "decimals_",
        type: "uint8"
      },
      {
        internalType: "uint256",
        name: "housingValue",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "remainingUnits",
        type: "uint256"
      },
      {
        internalType: "bool",
        name: "active",
        type: "bool"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "amountTokens",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "priceWei",
        type: "uint256"
      },
      {
        internalType: "address",
        name: "ownerAddress",
        type: "address"
      }
    ],
    name: "buyToken",
    outputs: [],
    stateMutability: "payable",
    type: "function"
  }
];

export default function MenuPage() {
  const [loading, setLoading] = useState(true);
  const [propsData, setPropsData] = useState([]);
  const [error, setError] = useState("");

  // modal
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);

  // token balances - stores tokenAddress -> {remainingUnits, active, owner, housingValue}
  const [tokenBalances, setTokenBalances] = useState({});

  // buy state
  const [buying, setBuying] = useState(false);
  const [buyAmount, setBuyAmount] = useState("10");

  const loadTokenBalances = async (properties) => {
    try {
      if (typeof window === "undefined" || !window.ethereum) return;
      
      const provider = new BrowserProvider(window.ethereum);
      const vault = new Contract(VAULT_ADDRESS, VAULT_ABI, provider);
      
      const balances = {};
      
      // Fetch token balances for each property that has a tokenAddress
      await Promise.all(
        properties.map(async (prop) => {
          if (!isAddress(prop.tokenAddress)) return;
          
          try {
            const listing = await vault.getListing(prop.tokenAddress);
            balances[prop.tokenAddress] = {
              owner: listing.owner,
              decimals: Number(listing.decimals_),
              housingValue: listing.housingValue.toString(),
              remainingUnits: listing.remainingUnits.toString(),
              active: Boolean(listing.active),
            };
          } catch (e) {
            console.warn(`Failed to fetch listing for ${prop.tokenAddress}:`, e);
            balances[prop.tokenAddress] = {
              owner: "",
              decimals: 18,
              housingValue: "0",
              remainingUnits: "0",
              active: false,
            };
          }
        })
      );
      
      setTokenBalances(balances);
    } catch (e) {
      console.error("Failed to load token balances:", e);
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/getproperty");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const list = Array.isArray(data?.properties) ? data.properties : [];
      setPropsData(list);
      
      // Load token balances
      await loadTokenBalances(list);
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

  const buyTokens = async (property) => {
    try {
      if (!property.tokenAddress || !isAddress(property.tokenAddress)) {
        throw new Error("Invalid token address");
      }
      
      const listing = tokenBalances[property.tokenAddress];
      if (!listing || !listing.active) {
        throw new Error("No active listing found for this property");
      }

      const buyAmt = (buyAmount || "").trim();
      if (!/^\d+(\.\d+)?$/.test(buyAmt)) throw new Error("Enter a numeric amount to buy");

      const amountTokens = parseInt(buyAmt);
      if (amountTokens <= 0 || amountTokens > 100) throw new Error("Amount must be between 1 and 100 whole tokens");

      const ownerForBuy = isAddress(listing.owner) ? listing.owner : null;
      if (!ownerForBuy) throw new Error("Owner unknown; cannot proceed with buy");

      // Calculate price using the contract formula: (housingValue * 1e18 * amountTokens) / 1_000_000
      const housingValue = BigInt(listing.housingValue);
      const priceWei = (housingValue * BigInt(1e18) * BigInt(amountTokens)) / BigInt(1_000_000);
      
      if (priceWei <= 0n) throw new Error("Calculated price is 0; check listing housingValue");

      setBuying(true);
      setError("");

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const vault = new Contract(VAULT_ADDRESS, VAULT_ABI, signer);
      
      const tx = await vault.buyToken(amountTokens, priceWei, ownerForBuy, {
        value: priceWei,
      });
      
      const receipt = await tx.wait();
      
      setError(`✅ Purchased ${amountTokens} tokens! Tx: ${receipt.hash}`);
      
      // Refresh token balances
      await loadTokenBalances(propsData);
      
    } catch (e) {
      console.error(e);
      const msg = e?.info?.error?.message || e?.shortMessage || e?.reason || e?.message || String(e);
      setError(`❌ ${msg}`);
    } finally {
      setBuying(false);
    }
  };

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
    tokenBalance: { fontSize: 12, color: "#059669", marginTop: 4, fontWeight: 600 },
    buySection: { marginTop: 12, padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" },
    buyInput: { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #d1d5db", marginBottom: 8 },
    buyBtn: { background: "#059669", color: "white", border: 0, padding: "8px 12px", borderRadius: 6, fontWeight: 600, cursor: "pointer", width: "100%" },
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

            // Get token balance info
            const balance = tokenBalances[p.tokenAddress];
            const remainingTokens = balance && balance.remainingUnits 
              ? formatUnits(BigInt(balance.remainingUnits), balance.decimals || 18)
              : "0";

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
                  {balance && (
                    <div style={styled.tokenBalance}>
                      Available: {Number(remainingTokens).toFixed(2)} tokens
                      {balance.active ? " 🟢" : " 🔴"}
                    </div>
                  )}
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

                {/* Buy Section */}
                {active.tokenAddress && tokenBalances[active.tokenAddress] && (
                  <div style={styled.buySection}>
                    <h4 style={{ margin: "0 0 8px 0", color: "#374151" }}>Purchase Tokens</h4>
                    
                    {(() => {
                      const balance = tokenBalances[active.tokenAddress];
                      const remainingTokens = balance.remainingUnits 
                        ? formatUnits(BigInt(balance.remainingUnits), balance.decimals || 18)
                        : "0";
                      
                      return (
                        <>
                          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
                            Available: {Number(remainingTokens).toFixed(2)} tokens
                            {balance.active ? " (Active)" : " (Inactive)"}
                          </div>
                          
                          {balance.active ? (
                            <>
                              <input
                                type="number"
                                min="1"
                                max="100"
                                step="1"
                                value={buyAmount}
                                onChange={(e) => setBuyAmount(e.target.value)}
                                placeholder="Amount to buy (1-100)"
                                style={styled.buyInput}
                              />
                              
                              {(() => {
                                try {
                                  const amountTokens = parseInt(buyAmount || "0");
                                  if (amountTokens > 0 && amountTokens <= 100) {
                                    const housingValue = BigInt(balance.housingValue);
                                    const priceWei = (housingValue * BigInt(1e18) * BigInt(amountTokens)) / BigInt(1_000_000);
                                    return (
                                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
                                        Price: {formatUnits(priceWei, 18)} TEST
                                      </div>
                                    );
                                  }
                                  return null;
                                } catch { return null; }
                              })()}
                              
                              <button 
                                onClick={() => buyTokens(active)}
                                disabled={buying || !buyAmount || parseInt(buyAmount) <= 0}
                                style={{
                                  ...styled.buyBtn,
                                  opacity: (buying || !buyAmount || parseInt(buyAmount) <= 0) ? 0.6 : 1,
                                  cursor: (buying || !buyAmount || parseInt(buyAmount) <= 0) ? "not-allowed" : "pointer"
                                }}
                              >
                                {buying ? "Purchasing..." : "Buy Tokens"}
                              </button>
                            </>
                          ) : (
                            <div style={{ fontSize: 13, color: "#dc2626" }}>
                              This property is not available for purchase
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
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