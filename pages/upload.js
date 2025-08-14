import { useEffect, useState, useMemo } from "react";
import { BrowserProvider, Contract, Interface, ZeroAddress, isAddress } from "ethers";

const SAPPHIRE_TESTNET = {
  chainId: "0x5aff", // 23295
  chainName: "Oasis Sapphire Testnet",
  nativeCurrency: { name: "Sapphire Test ROSE", symbol: "TEST", decimals: 18 },
  rpcUrls: ["https://testnet.sapphire.oasis.io"],
  blockExplorerUrls: ["https://explorer.oasis.io/testnet/sapphire"],
};

// Factory address (env first, then fallback)
const FACTORY_ADDRESS =
  process.env.NEXT_PUBLIC_FACTORY_ADDRESS ||
  "0x00cAe9ED35dCdf0F5C14c5EC11797E8c4d3dBB52";

// Minimal ABI for your PropertyTokenFactory
const FACTORY_ABI = [
  { inputs: [], name: "AlreadyMinted", type: "error" },
  { inputs: [], name: "InvalidHexString", type: "error" },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "string", name: "idHex6", type: "string" },
      { indexed: false, internalType: "address", name: "token", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "TokenCreated",
    type: "event",
  },
  {
    inputs: [{ internalType: "string", name: "s", type: "string" }],
    name: "isValidHex6",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "idHex6", type: "string" }],
    name: "mintToken",
    outputs: [{ internalType: "address", name: "token", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "", type: "string" }],
    name: "tokenOf",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

export default function UploadPage() {
  const [loading, setLoading] = useState(true);
  const [ids, setIds] = useState([]);
  const [idHex, setIdHex] = useState("");
  const [housingValue, setHousingValue] = useState("");
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [mintTx, setMintTx] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");

  const idUpper = useMemo(() => (idHex || "").toUpperCase(), [idHex]);

  const loadIds = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/upload");
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
  };

  useEffect(() => {
    loadIds();
  }, []);

  const onFiles = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 3) {
      setStatus("Max 3 images allowed; extra files ignored.");
      setFiles(selected.slice(0, 3));
    } else {
      setStatus("");
      setFiles(selected);
    }
  };

  async function ensureSapphire() {
    if (typeof window === "undefined" || !window.ethereum) throw new Error("No injected wallet found");
    try {
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      if (chainId?.toLowerCase() !== SAPPHIRE_TESTNET.chainId.toLowerCase()) {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: SAPPHIRE_TESTNET.chainId }],
        });
      }
    } catch (e) {
      if (e?.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [SAPPHIRE_TESTNET],
        });
      } else {
        throw e;
      }
    }
  }

  async function mintAndPersistToken(idHex6) {
    setStatus("Minting ERC20 (100 tokens)...");
    setMintTx("");
    setTokenAddress("");

    const provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();

    // Optional: check if already minted
    try {
      const read = new Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
      const existing = await read.tokenOf(idHex6);
      if (existing && existing !== ZeroAddress) {
        setStatus("Token already exists for this ID. Skipping mint.");
        setTokenAddress(existing);
        // Update id.json with existing address
        await fetch("/api/upload", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idHex: idHex6, tokenAddress: existing }),
        });
        return existing;
      }
    } catch {
      // ignore; proceed to mint
    }

    const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
    const tx = await factory.mintToken(idHex6);
    setMintTx(tx.hash);
    const receipt = await tx.wait();

    // Try mapping first
    let mintedAddr = ZeroAddress;
    try {
      const read = new Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
      mintedAddr = await read.tokenOf(idHex6);
    } catch {}

    // Fallback to parsing the event
    if (!mintedAddr || mintedAddr === ZeroAddress) {
      try {
        const iface = new Interface(FACTORY_ABI);
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog(log);
            if (parsed?.name === "TokenCreated") {
              mintedAddr = parsed.args?.token;
              break;
            }
          } catch {}
        }
      } catch {}
    }

    if (!mintedAddr || mintedAddr === ZeroAddress) {
      throw new Error("Mint succeeded, but token address not found.");
    }

    setTokenAddress(mintedAddr);

    // Persist token address into id.json
    setStatus("Saving token address to id.json…");
    const r = await fetch("/api/upload", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idHex: idHex6, tokenAddress: mintedAddr }),
    });
    if (!r.ok) throw new Error(await r.text());

    setStatus("Saved & minted ✅");
    return mintedAddr;
  }

  const submit = async (e) => {
    e.preventDefault();
    if (!idHex) return setStatus("Pick a property ID first.");
    if (files.length === 0 && !housingValue.trim()) {
      return setStatus("Add at least one image or a housing value.");
    }

    try {
      setStatus("Uploading…");
      setResult(null);
      setError("");
      setMintTx("");
      setTokenAddress("");

      const fd = new FormData();
      fd.append("idHex", idUpper);
      fd.append("housingValue", housingValue.trim());
      for (const f of files.slice(0, 3)) fd.append("images", f);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);

      // Auto-mint AFTER files/values are saved
      setStatus("Preparing to mint…");
      await ensureSapphire();
      await mintAndPersistToken(idUpper);

      // refresh IDs
      loadIds();
    } catch (e2) {
      console.error(e2);
      setStatus("");
      setError(e2.message || "Upload/mint failed");
    }
  };

  return (
    <main style={{ maxWidth: 880, margin: "40px auto", padding: 24, fontFamily: "system-ui" }}>
      <h1>Upload Images & Housing Value</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Select a property ID from <code>data/id.json</code>, upload up to <strong>3 images</strong>,
        and/or enter a housing value. Images are saved under <code>/img/&lt;ID&gt;/filename</code>.
        After saving, this page will automatically mint a 100-supply ERC-20 with name/symbol = the 6-hex ID, and store its address in <code>data/id.json</code>.
      </p>

      <div style={{ margin: "12px 0" }}>
        <button onClick={loadIds} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh IDs"}
        </button>
      </div>

      {error && (
        <p style={{ color: "crimson" }}>
          <strong>Error:</strong> {error}
        </p>
      )}

      <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span><strong>Property ID (hex, 6)</strong></span>
          <select
            value={idHex}
            onChange={(e) => setIdHex(e.target.value)}
            disabled={loading || ids.length === 0}
          >
            {ids.length === 0 ? (
              <option value="">No IDs found</option>
            ) : (
              ids.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))
            )}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span><strong>Housing Value (optional)</strong></span>
          <input
            type="text"
            placeholder="e.g. 650000"
            value={housingValue}
            onChange={(e) => setHousingValue(e.target.value)}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>
            <strong>Images (max 3)</strong> <em style={{ opacity: 0.7 }}>(jpg/png/webp)</em>
          </span>
          <input type="file" accept="image/*" multiple onChange={onFiles} />
          <div style={{ opacity: 0.7 }}>
            Selected: {files.length} file{files.length !== 1 ? "s" : ""} (max 3)
          </div>
        </label>

        <button type="submit" disabled={loading || !idHex}>
          Save & Mint
        </button>
      </form>

      {status && (
        <p style={{ marginTop: 12 }}>
          <strong>Status:</strong> {status}
        </p>
      )}

      {(mintTx || tokenAddress) && (
        <div style={{ marginTop: 12 }}>
          {mintTx && (
            <div>
              <strong>Mint Tx:</strong>{" "}
              <a href={`https://explorer.oasis.io/testnet/sapphire/tx/${mintTx}`} target="_blank" rel="noreferrer">
                {mintTx}
              </a>
            </div>
          )}
          {tokenAddress && (
            <div style={{ marginTop: 6 }}>
              <strong>Token Address:</strong>{" "}
              <a href={`https://explorer.oasis.io/testnet/sapphire/address/${tokenAddress}`} target="_blank" rel="noreferrer">
                {tokenAddress}
              </a>
            </div>
          )}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 12 }}>
          <div><strong>Saved ID:</strong> {result.idHex}</div>
          {result.housingValue && (
            <div><strong>Housing Value:</strong> {result.housingValue}</div>
          )}
          {Array.isArray(result.saved) && result.saved.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong>Saved Images:</strong>
              <ul>
                {result.saved.map((p) => (
                  <li key={p} style={{ wordBreak: "break-all" }}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {result.tokenAddress && (
            <div style={{ marginTop: 6 }}>
              <strong>Existing Token (from id.json):</strong>{" "}
              <a href={`https://explorer.oasis.io/testnet/sapphire/address/${result.tokenAddress}`} target="_blank" rel="noreferrer">
                {result.tokenAddress}
              </a>
            </div>
          )}
        </div>
      )}
    </main>
  );
}