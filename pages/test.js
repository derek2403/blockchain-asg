// pages/test.js
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BrowserProvider,
  Contract,
  Interface,
  formatUnits,
  ZeroAddress,
  isAddress,
} from "ethers";

const SAPPHIRE_TESTNET = {
  chainId: "0x5aff", // 23295
  chainName: "Oasis Sapphire Testnet",
  nativeCurrency: { name: "Sapphire Test ROSE", symbol: "TEST", decimals: 18 },
  rpcUrls: ["https://testnet.sapphire.oasis.io"],
  blockExplorerUrls: ["https://explorer.oasis.io/testnet/sapphire"],
};

// Default to your deployed factory (you can change it in the UI)
const FACTORY_DEFAULT = "0x00cAe9ED35dCdf0F5C14c5EC11797E8c4d3dBB52";

// == PropertyTokenFactory ABI ==
const FACTORY_ABI = [
  { "inputs": [], "name": "AlreadyMinted", "type": "error" },
  { "inputs": [], "name": "InvalidHexString", "type": "error" },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "internalType": "string",  "name": "idHex6", "type": "string" },
      { "indexed": false, "internalType": "address", "name": "token",  "type": "address" },
      { "indexed": true,  "internalType": "address", "name": "to",     "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "TokenCreated",
    "type": "event"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "ids",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "idsCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "string", "name": "s", "type": "string" }],
    "name": "isValidHex6",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "string", "name": "idHex6", "type": "string" }],
    "name": "mintToken",
    "outputs": [{ "internalType": "address", "name": "token", "type": "address" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "name": "tokenOf",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  }
];

// == Minimal ERC20 ABI for reading back ==
const HEX_ERC20_ABI = [
  { "inputs": [], "name": "name",        "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "symbol",      "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "decimals",    "outputs": [{ "internalType": "uint8",  "name": "", "type": "uint8"  }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "totalSupply", "outputs": [{ "internalType": "uint256","name": "", "type": "uint256"}], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256","name": "", "type": "uint256"}], "stateMutability": "view", "type": "function" }
];

export default function TestMintPage() {
  const [factoryAddr, setFactoryAddr] = useState(FACTORY_DEFAULT);
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("");
  const [warn, setWarn] = useState("");
  const [error, setError] = useState("");
  const [idHex, setIdHex] = useState("");

  const [mintTx, setMintTx] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenInfo, setTokenInfo] = useState(null);
  const [chainInfo, setChainInfo] = useState({ chainId: "", codeLen: 0 });

  const idUpper = useMemo(() => (idHex || "").trim().toUpperCase(), [idHex]);
  const idLooksValid = /^[0-9A-F]{6}$/.test(idUpper);
  const factoryLooksValid = useMemo(() => isAddress(factoryAddr), [factoryAddr]);

  const ensureSapphire = useCallback(async () => {
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
  }, []);

  const connect = useCallback(async () => {
    setStatus("Connecting wallet…"); setWarn(""); setError("");
    await ensureSapphire();
    const provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const addr = await signer.getAddress();
    const net = await provider.getNetwork();
    setAccount(addr);
    setChainInfo({ chainId: net?.chainId?.toString() || "", codeLen: 0 });

    // Probe contract code, but don't block if it returns 0x (some RPCs do that)
    try {
      const code = await provider.getCode(factoryAddr);
      setChainInfo(ci => ({ ...ci, codeLen: (code || "").length }));
      if (!code || code === "0x" || code === "0x0") {
        setWarn("Couldn't read contract code at the factory address (RPC returned 0x). You can still try minting.");
      }
    } catch {
      setWarn("Couldn't read contract code (RPC error). You can still try minting.");
    }
    setStatus("Connected");
  }, [ensureSapphire, factoryAddr]);

  useEffect(() => {
    (async () => {
      try {
        if (typeof window !== "undefined" && window.ethereum) {
          const accs = await window.ethereum.request({ method: "eth_accounts" });
          if (accs?.length) connect();
        }
      } catch {}
    })();
  }, [connect]);

  const doMint = async (e) => {
    e.preventDefault();
    setError(""); setWarn(""); setStatus(""); setMintTx(""); setTokenAddress(""); setTokenInfo(null);

    if (!account) return setError("Connect your wallet first.");
    if (!factoryLooksValid) return setError("Enter a valid factory address (0x…).");
    if (!idLooksValid) return setError("Enter a 6-digit hex string (e.g. A1B2C3).");

    try {
      setStatus("Preparing transaction…");
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Optional: soft validation via view call (don't block on errors)
      try {
        const r = new Contract(factoryAddr, FACTORY_ABI, provider);
        const ok = await r.isValidHex6(idUpper);
        if (!ok) throw new Error("Factory says the ID is not valid 6-hex.");
      } catch (vErr) {
        setWarn(`Skipping preflight validation: ${vErr?.shortMessage || vErr?.message || vErr}`);
      }

      const factory = new Contract(factoryAddr, FACTORY_ABI, signer);

      setStatus("Sending mint tx (100 tokens to your wallet)...");
      const tx = await factory.mintToken(idUpper);
      setMintTx(tx.hash);
      const receipt = await tx.wait();

      setStatus("Minted! Resolving token address…");
      let tokenAddr = ZeroAddress;

      // Try mapping first
      try {
        const r = new Contract(factoryAddr, FACTORY_ABI, provider);
        tokenAddr = await r.tokenOf(idUpper);
      } catch {}

      // Fallback: parse the TokenCreated event
      if (!tokenAddr || tokenAddr === ZeroAddress) {
        const iface = new Interface(FACTORY_ABI);
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog(log);
            if (parsed?.name === "TokenCreated") {
              tokenAddr = parsed.args?.token;
              break;
            }
          } catch {}
        }
      }

      if (!tokenAddr || tokenAddr === ZeroAddress) throw new Error("Token address not found after mint.");
      setTokenAddress(tokenAddr);

      // Read token basics
      const erc20 = new Contract(tokenAddr, HEX_ERC20_ABI, provider);
      const [name, symbol, decimals, totalSupply, balance] = await Promise.all([
        erc20.name(),
        erc20.symbol(),
        erc20.decimals(),
        erc20.totalSupply(),
        erc20.balanceOf(account),
      ]);

      setTokenInfo({
        name,
        symbol,
        decimals: Number(decimals),
        totalSupply: `${formatUnits(totalSupply, decimals)} (${totalSupply.toString()} raw)`,
        balance: `${formatUnits(balance, decimals)} (${balance.toString()} raw)`,
      });
      setStatus("Done ✅");
    } catch (err) {
      console.error(err);
      const msg =
        err?.info?.error?.message ||
        err?.shortMessage ||
        err?.reason ||
        err?.message ||
        String(err);
      setError(msg);
    }
  };

  return (
    <main style={{ maxWidth: 760, margin: "40px auto", padding: 24, fontFamily: "system-ui" }}>
      <h1>Mint Hex Token (via PropertyTokenFactory)</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>Sapphire Testnet (Chain ID 23295)</p>

      <div style={{ display: "grid", gap: 8, maxWidth: 650, marginBottom: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span><b>Factory Address</b></span>
          <input
            type="text"
            placeholder="0x… (PropertyTokenFactory)"
            value={factoryAddr}
            onChange={(e) => setFactoryAddr(e.target.value.trim())}
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
          />
          <small style={{ opacity: 0.7 }}>
            We'll try to read bytecode; if RPC returns 0x we'll show a warning but continue.
          </small>
        </label>
      </div>

      <div style={{ margin: "12px 0" }}>
        {account ? (
          <div>
            <strong>Connected:</strong> {account}
            {chainInfo.chainId && <span style={{ marginLeft: 8, opacity: 0.8 }}>(chainId: {chainInfo.chainId})</span>}
          </div>
        ) : (
          <button onClick={async () => { try { await connect(); } catch (e) { setError(e.message || String(e)); } }}>
            Connect Wallet
          </button>
        )}
      </div>

      <form onSubmit={doMint} style={{ display: "grid", gap: 12, maxWidth: 480 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span><b>Token ID (6-hex)</b></span>
          <input
            type="text"
            placeholder="e.g. B9F4B5"
            value={idHex}
            onChange={(e) => setIdHex(e.target.value)}
            style={{ textTransform: "uppercase" }}
          />
          <small style={{ opacity: 0.7 }}>
            Becomes token <em>name</em> and <em>symbol</em>. The factory mints <b>100 tokens</b> (18 decimals) to your wallet.
          </small>
        </label>
        <button type="submit" disabled={!account || !factoryLooksValid || !idLooksValid}>
          {account ? "Mint 100 Tokens" : "Connect wallet first"}
        </button>
      </form>

      {status && <p style={{ marginTop: 12 }}><b>Status:</b> {status}</p>}
      {warn && <p style={{ marginTop: 12, color: "#b7791f" }}><b>Warning:</b> {warn}</p>}
      {error && <p style={{ marginTop: 12, color: "crimson" }}><b>Error:</b> {error}</p>}

      {(mintTx || tokenAddress || tokenInfo || chainInfo.codeLen) && (
        <div style={{ marginTop: 16, border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
          <div><b>Factory code length (plain getCode):</b> {chainInfo.codeLen}</div>
          {mintTx && (
            <div style={{ marginTop: 8 }}>
              <b>Tx Hash:</b>{" "}
              <a href={`https://explorer.oasis.io/testnet/sapphire/tx/${mintTx}`} target="_blank" rel="noreferrer">
                {mintTx}
              </a>
            </div>
          )}
          {tokenAddress && (
            <div style={{ marginTop: 8 }}>
              <b>Token Address:</b>{" "}
              <a href={`https://explorer.oasis.io/testnet/sapphire/address/${tokenAddress}`} target="_blank" rel="noreferrer">
                {tokenAddress}
              </a>
            </div>
          )}
          {tokenInfo && (
            <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
              <div><b>Name:</b> {tokenInfo.name}</div>
              <div><b>Symbol:</b> {tokenInfo.symbol}</div>
              <div><b>Decimals:</b> {tokenInfo.decimals}</div>
              <div><b>Total Supply:</b> {tokenInfo.totalSupply}</div>
              <div><b>Your Balance:</b> {tokenInfo.balance}</div>
            </div>
          )}
        </div>
      )}

      <details style={{ marginTop: 16 }}>
        <summary>Troubleshooting</summary>
        <ul>
          <li>If “No contract code” shows, double-check the address is the <i>factory</i> on Sapphire <b>testnet</b>.</li>
          <li>This page uses plain ethers (no Sapphire wrapper). Tx will be public but should still succeed on Sapphire.</li>
          <li><code>AlreadyMinted</code> ⇒ pick another 6-hex. <code>InvalidHexString</code> ⇒ exactly 6 chars in [0-9A-F].</li>
        </ul>
      </details>
    </main>
  );
}