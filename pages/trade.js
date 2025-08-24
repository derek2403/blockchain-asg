// pages/trade.js
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  BrowserProvider,
  Contract,
  Interface,
  formatUnits,
  isAddress,
  parseUnits,
} from "ethers";

// Import property data
import propertyData from "../data/id.json";

const SAPPHIRE = {
  chainId: "0x5aff", // 23295
  chainName: "Oasis Sapphire Testnet",
  nativeCurrency: { name: "Sapphire Test ROSE", symbol: "TEST", decimals: 18 },
  rpcUrls: ["https://testnet.sapphire.oasis.io"],
  blockExplorerUrls: ["https://explorer.oasis.io/testnet/sapphire"],
};

// Escrow contract
const ESCROW_ADDRESS =
  process.env.NEXT_PUBLIC_ESCROW_ADDRESS ||
  "0xD7CE847C51277954150f6e22B4B0b0DE16BbB947";

const ESCROW_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "token", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "internalType": "uint256", "name": "priceWei", "type": "uint256" },
      { "internalType": "uint256", "name": "periodHours", "type": "uint256" }
    ],
    "name": "listForSale",
    "outputs": [{ "internalType": "uint256", "name": "listingId", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "listingId", "type": "uint256" }],
    "name": "buy",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "listingId", "type": "uint256" }],
    "name": "cancel",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "listingId", "type": "uint256" }],
    "name": "getListing",
    "outputs": [{
      "components": [
        { "internalType": "address", "name": "seller", "type": "address" },
        { "internalType": "address", "name": "token", "type": "address" },
        { "internalType": "uint256", "name": "amount", "type": "uint256" },
        { "internalType": "uint256", "name": "priceWei", "type": "uint256" },
        { "internalType": "uint64", "name": "createdAt", "type": "uint64" },
        { "internalType": "uint64", "name": "expiresAt", "type": "uint64" },
        { "internalType": "bool", "name": "active", "type": "bool" }
      ],
      "internalType": "struct TokenEscrow.Listing",
      "name": "",
      "type": "tuple"
    }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nextListingId",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "listingId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "seller", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "token", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "priceWei", "type": "uint256" },
      { "indexed": false, "internalType": "uint64", "name": "expiresAt", "type": "uint64" }
    ],
    "name": "Listed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "listingId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "buyer", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "priceWei", "type": "uint256" }
    ],
    "name": "Purchased",
    "type": "event"
  },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "listingId", "type": "uint256" }], "name": "Cancelled", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "listingId", "type": "uint256" }], "name": "Expired", "type": "event" }
];

// Minimal ERC20
const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 value) returns (bool)",
];

export default function TradePage() {
  const { address: account, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  // State
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  // Sell form
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [tokenDec, setTokenDec] = useState(18);
  const [tokenSym, setTokenSym] = useState("");
  const [amountStr, setAmountStr] = useState("10");
  const [priceStr, setPriceStr] = useState("1"); // TEST
  const [hoursStr, setHoursStr] = useState("24");
  const [myBal, setMyBal] = useState("0");

  // Market
  const [offers, setOffers] = useState([]);
  const [loadingMarket, setLoadingMarket] = useState(false);

  // Available properties (filter out empty ones)
  const availableProperties = useMemo(() => {
    return propertyData.filter(p => p.tokenAddress && isAddress(p.tokenAddress));
  }, []);

  // Get provider from wallet client
  const getProvider = useCallback(async () => {
    if (!walletClient) throw new Error("Wallet not connected");
    return new BrowserProvider(walletClient);
  }, [walletClient]);

  // Load token metadata when property changes
  useEffect(() => {
    (async () => {
      try {
        setError("");
        setMyBal("0");
        setTokenDec(18);
        setTokenSym("");
        
        if (!selectedProperty?.tokenAddress || !isAddress(selectedProperty.tokenAddress)) return;
        
        const provider = await getProvider();
        const erc = new Contract(selectedProperty.tokenAddress, ERC20_ABI, provider);
        const [d, s] = await Promise.all([erc.decimals(), erc.symbol()]);
        setTokenDec(Number(d));
        setTokenSym(s);
        
        if (account) {
          const bal = await erc.balanceOf(account);
          setMyBal(bal.toString());
        }
      } catch (e) {
        setError(e.message || "Failed to read token");
      }
    })();
  }, [selectedProperty, account, getProvider]);

  // Update selected property when ID changes
  useEffect(() => {
    const property = availableProperties.find(p => p.idHex === selectedPropertyId);
    setSelectedProperty(property || null);
  }, [selectedPropertyId, availableProperties]);

  // ------- SELL -------
  async function createListing(e) {
    e?.preventDefault?.();
    try {
      if (!account) throw new Error("Connect wallet first.");
      if (!selectedProperty?.tokenAddress) throw new Error("Select a valid property.");
      if (!/^\d+(\.\d+)?$/.test(amountStr)) throw new Error("Enter token amount (e.g. 10.5).");
      if (!/^\d+(\.\d+)?$/.test(priceStr)) throw new Error("Enter price in TEST (e.g. 1.25).");
      const hours = parseInt(hoursStr || "0");
      if (!(hours > 0 && hours <= 24 * 30)) throw new Error("Hours must be 1–720.");

      setStatus("Checking allowance…");
      setError("");

      const provider = await getProvider();
      const signer = await provider.getSigner();
      const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
      const erc = new Contract(selectedProperty.tokenAddress, ERC20_ABI, signer);

      const amountRaw = parseUnits(amountStr, tokenDec);
      const priceWei = parseUnits(priceStr, 18);

      const current = await erc.allowance(account, ESCROW_ADDRESS);
      if (current < amountRaw) {
        setStatus("Approving escrow to transfer your tokens…");
        const txA = await erc.approve(ESCROW_ADDRESS, amountRaw);
        await txA.wait();
      }

      setStatus("Creating listing…");
      const tx = await escrow.listForSale(selectedProperty.tokenAddress, amountRaw, priceWei, hours);
      const rc = await tx.wait();

      // try to pull listingId from event
      let listingId;
      try {
        const iface = new Interface(ESCROW_ABI);
        for (const l of rc.logs) {
          try {
            const parsed = iface.parseLog(l);
            if (parsed?.name === "Listed") {
              listingId = parsed.args?.listingId?.toString();
              break;
            }
          } catch {}
        }
      } catch {}
      setStatus(`Listed! ${listingId ? `ID #${listingId}` : ""}`);

      // refresh market + balance
      await Promise.all([loadMarket(), refreshMyBalance()]);
    } catch (e) {
      setError(e?.shortMessage || e?.reason || e?.message || String(e));
      setStatus("");
    }
  }

  async function refreshMyBalance() {
    try {
      if (!selectedProperty?.tokenAddress || !isAddress(selectedProperty.tokenAddress) || !account) return;
      const provider = await getProvider();
      const erc = new Contract(selectedProperty.tokenAddress, ERC20_ABI, provider);
      const bal = await erc.balanceOf(account);
      setMyBal(bal.toString());
    } catch {}
  }

  // ------- MARKET -------
  async function loadMarket() {
    try {
      setLoadingMarket(true);
      setError("");
      const provider = await getProvider();
      const escrowR = new Contract(ESCROW_ADDRESS, ESCROW_ABI, provider);

      const next = await escrowR.nextListingId();
      const n = Number(next);
      const rows = [];
      for (let id = 1; id < n; id++) {
        try {
          const L = await escrowR.getListing(id);
          const active = L.active && Number(L.expiresAt) * 1000 > Date.now();
          if (!active) continue;

          // Find property info
          const property = availableProperties.find(p => 
            p.tokenAddress.toLowerCase() === L.token.toLowerCase()
          );

          // token meta
          const erc = new Contract(L.token, ERC20_ABI, provider);
          let dec = 18, sym = "";
          try {
            dec = Number(await erc.decimals());
            sym = await erc.symbol();
          } catch {}
          
          rows.push({
            listingId: id,
            seller: L.seller,
            token: L.token,
            amountRaw: L.amount,
            priceWei: L.priceWei,
            createdAt: Number(L.createdAt),
            expiresAt: Number(L.expiresAt),
            tokenDec: dec,
            tokenSym: sym,
            property: property || null,
          });
        } catch {}
      }
      setOffers(rows);
    } catch (e) {
      setError(e.message || "Failed to load market");
    } finally {
      setLoadingMarket(false);
    }
  }

  useEffect(() => {
    if (isConnected) {
      loadMarket();
    }
  }, [isConnected]);

  async function buy(listingId, priceWei) {
    try {
      if (!account) throw new Error("Connect wallet first.");
      setStatus(`Buying listing #${listingId}…`);
      setError("");
      const provider = await getProvider();
      const signer = await provider.getSigner();
      const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
      const tx = await escrow.buy(listingId, { value: priceWei });
      const rc = await tx.wait();
      setStatus(`Purchased! Tx: ${rc.hash}`);
      await loadMarket();
    } catch (e) {
      setError(e?.shortMessage || e?.reason || e?.message || String(e));
      setStatus("");
    }
  }

  async function cancel(listingId) {
    try {
      const provider = await getProvider();
      const signer = await provider.getSigner();
      const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
      setStatus(`Cancelling #${listingId}…`);
      const tx = await escrow.cancel(listingId);
      const rc = await tx.wait();
      setStatus(`Cancelled. Tx: ${rc.hash}`);
      await loadMarket();
    } catch (e) {
      setError(e?.shortMessage || e?.reason || e?.message || String(e));
      setStatus("");
    }
  }

  // derived
  const myBalFmt = useMemo(
    () => (myBal ? formatUnits(BigInt(myBal || "0"), tokenDec) : "0"),
    [myBal, tokenDec]
  );
  const willReceive = useMemo(() => {
    const n = Number(priceStr);
    return Number.isFinite(n) ? n.toString() : "0";
  }, [priceStr]);

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
    section: { marginTop: 32, paddingTop: 8 },
    h2: { margin: "8px 0 12px", fontSize: 20, color: "#0f172a" },
    card: {
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 16,
      padding: 24,
      boxShadow: "0 10px 24px rgba(0,0,0,.06)",
      marginBottom: 24,
    },
    label: { display: "grid", gap: 6, marginBottom: 16 },
    input: {
      padding: "12px 14px",
      border: "2px solid #e5e7eb",
      borderRadius: 10,
      fontSize: 14,
      outline: "none",
    },
    select: {
      padding: "12px 14px",
      border: "2px solid #e5e7eb",
      borderRadius: 10,
      fontSize: 14,
      outline: "none",
      background: "white",
    },
    buttonPrimary: {
      background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
      color: "white",
      border: "none",
      padding: "12px 18px",
      borderRadius: 10,
      fontWeight: 600,
      cursor: "pointer",
    },
    buttonWarn: {
      background: "linear-gradient(135deg, #f59e0b, #ef4444)",
      color: "white",
      border: "none",
      padding: "10px 14px",
      borderRadius: 10,
      fontWeight: 600,
      cursor: "pointer",
    },
    buttonGhost: {
      background: "#f1f5f9",
      color: "#0f172a",
      border: "1px solid #e2e8f0",
      padding: "10px 14px",
      borderRadius: 10,
      fontWeight: 600,
      cursor: "pointer",
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
      gap: 16,
    },
    offerCard: {
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: 16,
      background: "#fff",
    },
    note: {
      marginTop: 16,
      padding: 12,
      border: "1px solid",
      borderRadius: 10,
    },
    connectButton: {
      display: "flex",
      justifyContent: "center",
      marginBottom: 24,
    },
  };

  return (
    <div style={styled.page}>
      <div style={styled.wrap}>
        <h1 style={styled.title}>Token Trading</h1>
        <p style={styled.sub}>Trade property tokens using the escrow contract.</p>

        {!isConnected && (
          <div style={styled.card}>
            <p style={{ textAlign: "center", color: "#6b7280" }}>
              Please connect your wallet to start trading.
            </p>
          </div>
        )}

        {isConnected && (
          <>
            {/* SELL SECTION */}
            <section style={styled.section}>
              <div style={styled.card}>
                <h2 style={styled.h2}>Sell Tokens</h2>
                <form onSubmit={createListing} style={{ display: "grid", gap: 12, maxWidth: 720 }}>
                  <label style={styled.label}>
                    <span>Select Property</span>
                    <select
                      value={selectedPropertyId}
                      onChange={(e) => setSelectedPropertyId(e.target.value)}
                      style={styled.select}
                    >
                      <option value="">Choose a property...</option>
                      {availableProperties.map((prop) => (
                        <option key={prop.idHex} value={prop.idHex}>
                          {prop.idHex} - {prop.tokenAddress.slice(0, 8)}...{prop.tokenAddress.slice(-6)}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedProperty && (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <label style={styled.label}>
                          <span>Amount (tokens)</span>
                          <input
                            value={amountStr}
                            onChange={(e) => setAmountStr(e.target.value)}
                            placeholder="e.g. 10"
                            style={styled.input}
                          />
                        </label>
                        <label style={styled.label}>
                          <span>Price (TEST)</span>
                          <input
                            value={priceStr}
                            onChange={(e) => setPriceStr(e.target.value)}
                            placeholder="e.g. 1.5"
                            style={styled.input}
                          />
                        </label>
                      </div>

                      <label style={styled.label}>
                        <span>Expiry (hours)</span>
                        <input
                          value={hoursStr}
                          onChange={(e) => setHoursStr(e.target.value)}
                          type="number"
                          min="1"
                          max={24 * 30}
                          style={styled.input}
                        />
                      </label>

                      <div style={{ fontSize: 14, color: "#475569" }}>
                        Token: {tokenSym || "—"} · Decimals: {tokenDec} · Your balance: {myBalFmt}
                      </div>

                      <div style={{ fontSize: 14, color: "#475569" }}>
                        You will receive <b>{willReceive}</b> TEST if the lot sells.
                      </div>

                      <div>
                        <button type="submit" disabled={!selectedProperty} style={styled.buttonPrimary}>
                          Approve & List
                        </button>
                      </div>
                    </>
                  )}
                </form>
              </div>
            </section>

            {/* MARKET SECTION */}
            <section style={styled.section}>
              <div style={styled.card}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <h2 style={styled.h2}>Buy Tokens (Available Offers)</h2>
                  <button onClick={loadMarket} disabled={loadingMarket} style={styled.buttonGhost}>
                    {loadingMarket ? "Refreshing…" : "Refresh"}
                  </button>
                </div>

                {offers.length === 0 ? (
                  <div style={{ opacity: 0.7 }}>No active listings.</div>
                ) : (
                  <div style={styled.grid}>
                    {offers.map((o) => {
                      const amt = formatUnits(o.amountRaw, o.tokenDec);
                      const price = formatUnits(o.priceWei, 18);
                      const mine = account && o.seller.toLowerCase() === account.toLowerCase();
                      const exp = new Date(o.expiresAt * 1000);
                      
                      return (
                        <div key={o.listingId} style={styled.offerCard}>
                          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                            #{o.listingId} · {o.property ? `Property: ${o.property.idHex}` : "Unknown Property"}
                          </div>
                          
                          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 2 }}>
                            {amt} {o.tokenSym || "TOKEN"}
                          </div>
                          
                          <div style={{ fontSize: 14, marginBottom: 6 }}>
                            Price: <b>{price}</b> TEST
                          </div>
                          
                          <div style={{ fontSize: 12, opacity: 0.8 }}>
                            Token: 
                            <a
                              href={`https://explorer.oasis.io/testnet/sapphire/address/${o.token}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: "#4f46e5", textDecoration: "none", marginLeft: 4 }}
                            >
                              {o.token.slice(0, 6)}…{o.token.slice(-4)}
                            </a>
                          </div>
                          
                          <div style={{ fontSize: 12, opacity: 0.8 }}>
                            Seller: {o.seller.slice(0, 6)}…{o.seller.slice(-4)}
                          </div>
                          
                          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 10 }}>
                            Expires: {exp.toLocaleString()}
                          </div>
                          
                          <div style={{ display: "flex", gap: 8 }}>
                            {!mine ? (
                              <button
                                onClick={() => buy(o.listingId, o.priceWei)}
                                style={styled.buttonPrimary}
                              >
                                Buy
                              </button>
                            ) : (
                              <button onClick={() => cancel(o.listingId)} style={styled.buttonWarn}>
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {status && (
          <div style={{ ...styled.note, background: "#ecfdf5", borderColor: "#a7f3d0", color: "#065f46" }}>
            <b>Status:</b> {status}
          </div>
        )}
        {error && (
          <div style={{ ...styled.note, background: "#fef2f2", borderColor: "#fecaca", color: "#b91c1c" }}>
            <b>Error:</b> {error}
          </div>
        )}
      </div>

      <style jsx>{`
        button:disabled { opacity: .6; cursor: not-allowed; }
        a { color: #334155; text-decoration: underline; }
        a:hover { opacity: .85; }
      `}</style>
    </div>
  );
}
