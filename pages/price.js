import { useEffect, useMemo, useState } from "react";

export default function PricePage() {
  const [loading, setLoading] = useState(true);
  const [ids, setIds] = useState([]);
  const [idHex, setIdHex] = useState("");
  const [current, setCurrent] = useState(null); // {idHex, housingValue, pricePerTokenTEST, tokenAddress?, owner?}
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [newHV, setNewHV] = useState("");

  const idUpper = useMemo(() => (idHex || "").trim().toUpperCase(), [idHex]);
  const idLooksValid = /^[0-9A-F]{6}$/.test(idUpper);
  const hvLooksValid = useMemo(() => /^\d+$/.test(newHV.trim()), [newHV]);

  // Derived: tokens per TEST (prefer exact formula using housingValue; fallback to inverting price)
  const tokensPerTEST = useMemo(() => {
    if (!current) return null;
    const hvNum = Number(current.housingValue);
    if (!Number.isNaN(hvNum) && hvNum > 0) {
      return 1_000_000 / hvNum; // exact per our pricing rule
    }
    const priceNum = Number(current.pricePerTokenTEST);
    if (!Number.isNaN(priceNum) && priceNum > 0) {
      return 1 / priceNum;
    }
    return null;
  }, [current]);

  async function loadAll() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/price");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const props = Array.isArray(data?.properties) ? data.properties : [];
      const onlyIds = props.map((p) => p.idHex).filter(Boolean);
      setIds(onlyIds);
      if (onlyIds.length && !idHex) setIdHex(onlyIds[0]);
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to load IDs");
    } finally {
      setLoading(false);
    }
  }

  async function getPrice() {
    try {
      setStatus("Getting price…");
      setError("");
      setCurrent(null);
      const res = await fetch(`/api/price?id=${idUpper}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setCurrent(data);
      setNewHV(data.housingValue || "");
      setStatus("");
    } catch (e) {
      console.error(e);
      setStatus("");
      setError(e.message || "Failed to get price");
    }
  }

  async function updateHV(e) {
    e?.preventDefault?.();
    try {
      if (!idLooksValid) throw new Error("Enter a valid 6-hex ID.");
      if (!hvLooksValid) throw new Error("Housing value must be an integer (e.g. 650000).");

      setStatus("Updating housing value…");
      setError("");

      const res = await fetch("/api/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idHex: idUpper, housingValue: newHV.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      setCurrent(data);
      setStatus("Updated.");
      loadAll(); // refresh IDs in case a new entry was created
    } catch (e) {
      console.error(e);
      setStatus("");
      setError(e.message || "Update failed");
    }
  }

  useEffect(() => { loadAll(); }, []);

  return (
    <main style={{ maxWidth: 880, margin: "40px auto", padding: 24, fontFamily: "system-ui" }}>
      <h1>Housing Value & Tokens per TEST</h1>
      <p style={{ margin: "6px 0 16px", opacity: 0.8 }}>
        We store <code>housingValue</code> in <code>data/id.json</code>. Pricing:
        <br />
        <code>TEST per TOKEN = housingValue / 1,000,000</code> •
        <span style={{ marginLeft: 8 }} />
        <code>TOKENs per TEST = 1,000,000 / housingValue</code>
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={loadAll} disabled={loading}>{loading ? "Refreshing…" : "Refresh IDs"}</button>
        <button
          onClick={getPrice}
          disabled={!idLooksValid}
          title={!idLooksValid ? "Enter a valid 6-hex ID" : ""}
        >
          Get Price
        </button>
      </div>

      {error && <p style={{ color: "crimson" }}><b>Error:</b> {error}</p>}
      {status && <p><b>Status:</b> {status}</p>}

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
        <h3>Pick Property</h3>
        <label style={{ display: "grid", gap: 6, maxWidth: 360 }}>
          <span><b>Property ID (6-hex)</b></span>
          <input
            value={idHex}
            onChange={(e) => setIdHex(e.target.value)}
            placeholder="e.g. B9F4B5"
            style={{ textTransform: "uppercase" }}
            list="id-list"
          />
          <datalist id="id-list">
            {ids.map((x) => <option key={x} value={x} />)}
          </datalist>
        </label>
      </section>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginTop: 12 }}>
        <h3>Update Housing Value</h3>
        <form onSubmit={updateHV} style={{ display: "grid", gap: 10, maxWidth: 420 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span><b>New Housing Value</b> <em style={{ opacity: 0.7 }}>(integer, e.g. 650000)</em></span>
            <input
              value={newHV}
              onChange={(e) => setNewHV(e.target.value)}
              placeholder="e.g. 650000"
              inputMode="numeric"
              pattern="\d*"
            />
          </label>
          <button type="submit" disabled={!idLooksValid || !hvLooksValid}>
            Update
          </button>
        </form>
      </section>

      {current && (
        <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginTop: 12 }}>
          <h3>Current</h3>
          <div style={{ display: "grid", gap: 4 }}>
            <div><b>ID:</b> {current.idHex}</div>
            {"tokenAddress" in current && current.tokenAddress && (
              <div>
                <b>Token:</b>{" "}
                <a href={`https://explorer.oasis.io/testnet/sapphire/address/${current.tokenAddress}`} target="_blank" rel="noreferrer">
                  {current.tokenAddress}
                </a>
              </div>
            )}
            {"owner" in current && current.owner && <div><b>Owner:</b> {current.owner}</div>}
            <div><b>Housing Value:</b> {current.housingValue}</div>
            <div style={{ marginTop: 6 }}>
              <b>{current.idHex} per TEST:</b>{" "}
              {tokensPerTEST == null ? "—" : Number(tokensPerTEST).toFixed(6)}
            </div>
            <div style={{ opacity: 0.75 }}>
              <small>(For reference: TEST per {current.idHex} = {current?.pricePerTokenTEST ?? "—"})</small>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}