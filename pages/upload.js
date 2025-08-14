// pages/upload.js
import { useEffect, useMemo, useState } from "react";
import {
  BrowserProvider,
  Contract,
  Interface,
  ZeroAddress,
  isAddress,
  formatUnits,
} from "ethers";

const SAPPHIRE_TESTNET = {
  chainId: "0x5aff", // 23295
  chainName: "Oasis Sapphire Testnet",
  nativeCurrency: { name: "Sapphire Test ROSE", symbol: "TEST", decimals: 18 },
  rpcUrls: ["https://testnet.sapphire.oasis.io"],
  blockExplorerUrls: ["https://explorer.oasis.io/testnet/sapphire"],
};

const FACTORY_ADDRESS =
  process.env.NEXT_PUBLIC_FACTORY_ADDRESS ||
  "0x00cAe9ED35dCdf0F5C14c5EC11797E8c4d3dBB52";

/** ====== VAULT CONFIG ====== */
const VAULT_ADDRESS =
  process.env.NEXT_PUBLIC_VAULT_ADDRESS ||
  "0xe7533E80B13e34092873257Af615A0A72a3A8367";

/** Vault ABI (only what we need) */
const VAULT_ABI = [
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "token", type: "address" },
      { internalType: "uint256", name: "housingValue", type: "uint256" },
      { internalType: "uint256", name: "amountTokens", type: "uint256" },
    ],
    name: "depositTokens",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Optional: let us re-fetch the listing after deposit (nice to show success context)
  {
    inputs: [{ internalType: "address", name: "token", type: "address" }],
    name: "getListing",
    outputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "uint8", name: "decimals_", type: "uint8" },
      { internalType: "uint256", name: "housingValue", type: "uint256" },
      { internalType: "uint256", name: "remainingUnits", type: "uint256" },
      { internalType: "bool", name: "active", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
];

/** Minimal ERC20 ABI */
const ERC20_ABI = [
  { inputs: [], name: "decimals", outputs: [{ internalType: "uint8", name: "", type: "uint8" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "account", type: "address" }], name: "balanceOf", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];

/** PropertyTokenFactory ABI (minimal) */
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
  const [owner, setOwner] = useState("");
  const [housingValue, setHousingValue] = useState("");
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [mintTx, setMintTx] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [depositTx, setDepositTx] = useState("");

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

  async function getConnectedAddress() {
    const provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const addr = await signer.getAddress();
    setOwner(addr);
    return { provider, signer, addr };
  }

  /** Mint the token if needed; persist tokenAddress + owner; return token address */
  async function mintAndPersistToken(idHex6, addr) {
    setStatus("Minting ERC20 (100 tokens)...");
    setMintTx("");
    setTokenAddress("");

    const provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();

    // If already minted, reuse
    try {
      const read = new Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
      const existing = await read.tokenOf(idHex6);
      if (existing && existing !== ZeroAddress) {
        setStatus("Token already exists for this ID. Skipping mint.");
        setTokenAddress(existing);
        await fetch("/api/upload", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idHex: idHex6, tokenAddress: existing, owner: addr }),
        });
        return existing;
      }
    } catch {
      // ignore read error, try mint
    }

    const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
    const tx = await factory.mintToken(idHex6);
    setMintTx(tx.hash);
    const receipt = await tx.wait();

    // Get address from mapping, fallback to event
    const read = new Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
    let mintedAddr = ZeroAddress;
    try {
      mintedAddr = await read.tokenOf(idHex6);
    } catch {}
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

    // Save token address + owner into id.json
    setStatus("Saving token address to id.json…");
    const r = await fetch("/api/upload", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idHex: idHex6, tokenAddress: mintedAddr, owner: addr }),
    });
    if (!r.ok) throw new Error(await r.text());

    setStatus("Saved & minted ✅");
    return mintedAddr;
  }

  /** Approve full balance to VAULT and deposit all as whole tokens */
  async function approveAndDepositAllToVault(tokenAddr, ownerAddr, hvString) {
    setDepositTx("");

    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const erc20 = new Contract(tokenAddr, ERC20_ABI, signer);
    const decimals = Number(await erc20.decimals());
    const bal = BigInt(await erc20.balanceOf(ownerAddr).then(b => b.toString()));
    if (bal === 0n) {
      setStatus("You have 0 balance to deposit. Skipping deposit.");
      return null;
    }

    // Ensure allowance
    const allowance = BigInt(await erc20.allowance(ownerAddr, VAULT_ADDRESS).then(a => a.toString()));
    if (allowance < bal) {
      setStatus("Approving vault to spend your tokens…");
      const txA = await erc20.approve(VAULT_ADDRESS, bal);
      await txA.wait();
    }

    // Convert raw balance -> whole tokens
    const pow10 = (d) => (BigInt(10) ** BigInt(d));
    const wholeTokens = bal / pow10(decimals);
    if (wholeTokens === 0n) {
      setStatus("Not enough for 1 whole token after decimals. Skipping deposit.");
      return null;
    }

    const hv = BigInt((hvString || "0").trim() || "0");
    const vault = new Contract(VAULT_ADDRESS, VAULT_ABI, signer);

    setStatus(`Depositing ${wholeTokens.toString()} tokens into the vault…`);
    const tx = await vault.depositTokens(ownerAddr, tokenAddr, hv, wholeTokens);
    const rc = await tx.wait();
    setDepositTx(rc.hash);
    setStatus(`Deposited ${wholeTokens.toString()} tokens. Tx: ${rc.hash}`);

    // Optional: read back listing
    try {
      const providerRO = new BrowserProvider(window.ethereum);
      const vaultRO = new Contract(VAULT_ADDRESS, VAULT_ABI, providerRO);
      const lst = await vaultRO.getListing(tokenAddr);
      const rem = lst?.remainingUnits?.toString?.() || "0";
      setStatus(
        `Deposit complete. Remaining units in vault: ${rem}. Tx: ${rc.hash}`
      );
    } catch {
      // ignore
    }
    return rc.hash;
  }

  const submit = async (e) => {
    e.preventDefault();
    if (!idHex) return setStatus("Pick a property ID first.");
    if (files.length === 0 && !housingValue.trim()) {
      return setStatus("Add at least one image or a housing value.");
    }

    try {
      setStatus("Preparing wallet…");
      setResult(null);
      setError("");
      setMintTx("");
      setTokenAddress("");
      setDepositTx("");

      await ensureSapphire();
      const { addr } = await getConnectedAddress();

      // 1) Save images + HV (and write owner)
      setStatus("Uploading…");
      const fd = new FormData();
      fd.append("idHex", idUpper);
      fd.append("owner", addr);
      fd.append("housingValue", housingValue.trim());
      for (const f of files.slice(0, 3)) fd.append("images", f);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);

      // 2) Mint (or reuse) token address, persist in id.json
      setStatus("Minting token…");
      const tokenAddr = await mintAndPersistToken(idUpper, addr);

      // 3) Immediately approve + deposit ALL to the vault
      const hvForDeposit = String(data?.housingValue ?? housingValue.trim() ?? "0");
      setStatus("Approving & depositing to vault…");
      await approveAndDepositAllToVault(tokenAddr, addr, hvForDeposit);

      // Refresh IDs for the dropdown
      loadIds();
    } catch (e2) {
      console.error(e2);
      setStatus("");
      setError(e2.message || "Upload/mint/deposit failed");
    }
  };

  return (
    <main style={{ maxWidth: 880, margin: "40px auto", padding: 24, fontFamily: "system-ui" }}>
      <h1>Upload Images & Housing Value</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Select a property ID from <code>data/id.json</code>, upload up to <strong>3 images</strong>,
        and/or enter a housing value. After saving, this page will <b>auto-mint</b> a 100-supply ERC-20
        and then <b>auto-deposit your entire balance to the Vault</b>.
      </p>

      <div style={{ margin: "12px 0" }}>
        <button onClick={loadIds} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh IDs"}
        </button>
        {owner && (
          <span style={{ marginLeft: 12, opacity: 0.8 }}>
            <strong>Owner (wallet):</strong> {owner}
          </span>
        )}
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
          Save, Mint & Deposit to Vault
        </button>
      </form>

      {status && (
        <p style={{ marginTop: 12 }}>
          <strong>Status:</strong> {status}
        </p>
      )}

      {(mintTx || tokenAddress || depositTx) && (
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
          {depositTx && (
            <div style={{ marginTop: 6 }}>
              <strong>Deposit Tx:</strong>{" "}
              <a href={`https://explorer.oasis.io/testnet/sapphire/tx/${depositTx}`} target="_blank" rel="noreferrer">
                {depositTx}
              </a>
            </div>
          )}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 12 }}>
          <div><strong>Saved ID:</strong> {result.idHex}</div>
          {result.owner && <div><strong>Owner:</strong> {result.owner}</div>}
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