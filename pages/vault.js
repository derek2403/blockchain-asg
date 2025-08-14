// pages/vault.js
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BrowserProvider,
  Contract,
  Interface,
  formatUnits,
  parseUnits,
  isAddress,
} from "ethers";

/** ====== CONFIG ====== */
const SAPPHIRE_TESTNET = {
  chainId: "0x5aff", // 23295
  chainName: "Oasis Sapphire Testnet",
  nativeCurrency: { name: "Sapphire Test ROSE", symbol: "TEST", decimals: 18 },
  rpcUrls: ["https://testnet.sapphire.oasis.io"],
  blockExplorerUrls: ["https://explorer.oasis.io/testnet/sapphire"],
};

const VAULT_ADDRESS = "0xe7533E80B13e34092873257Af615A0A72a3A8367";

/** Complete Vault ABI from your contract */
const VAULT_ABI = [
  {
    inputs: [],
    name: "InsufficientInventory",
    type: "error"
  },
  {
    inputs: [],
    name: "InvalidAmount",
    type: "error"
  },
  {
    inputs: [],
    name: "InvalidOwner",
    type: "error"
  },
  {
    inputs: [],
    name: "InvalidToken",
    type: "error"
  },
  {
    inputs: [],
    name: "ListingInactive",
    type: "error"
  },
  {
    inputs: [],
    name: "NotOwner",
    type: "error"
  },
  {
    inputs: [],
    name: "PriceMismatch",
    type: "error"
  },
  {
    inputs: [],
    name: "ReentrancyGuardReentrantCall",
    type: "error"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "token",
        type: "address"
      }
    ],
    name: "SafeERC20FailedOperation",
    type: "error"
  },
  {
    inputs: [],
    name: "TransferFailed",
    type: "error"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "token",
        type: "address"
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "decimals",
        type: "uint8"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "housingValue",
        type: "uint256"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amountTokens",
        type: "uint256"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amountUnits",
        type: "uint256"
      }
    ],
    name: "Deposited",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "buyer",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "token",
        type: "address"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amountTokens",
        type: "uint256"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "paidWei",
        type: "uint256"
      }
    ],
    name: "Purchased",
    type: "event"
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
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address"
      },
      {
        internalType: "address",
        name: "token",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "housingValue",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "amountTokens",
        type: "uint256"
      }
    ],
    name: "depositTokens",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
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
        internalType: "address",
        name: "owner",
        type: "address"
      }
    ],
    name: "listedTokenOf",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address"
      }
    ],
    name: "listingOfToken",
    outputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address"
      },
      {
        internalType: "address",
        name: "token",
        type: "address"
      },
      {
        internalType: "uint8",
        name: "decimals",
        type: "uint8"
      },
      {
        internalType: "uint256",
        name: "housingValue",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "remaining",
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
        internalType: "address",
        name: "",
        type: "address"
      }
    ],
    name: "tokenOfOwner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    stateMutability: "payable",
    type: "receive"
  }
];

/** Minimal ERC20 we need */
const ERC20_ABI = [
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
  { inputs: [], name: "decimals", outputs: [{ internalType: "uint8", name: "", type: "uint8" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "account", type: "address" }], name: "balanceOf", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ internalType: "address", name: "spender", type: "address" }, { internalType: "uint256", name: "value", type: "uint256" }], name: "approve", outputs: [{ internalType: "bool", name: "", type: "bool" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "name", outputs: [{ internalType: "string", name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "symbol", outputs: [{ internalType: "string", name: "", type: "string" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "totalSupply", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" },
];

export default function VaultTestPage() {
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [warn, setWarn] = useState("");

  const [idHex, setIdHex] = useState("");
  const [resolved, setResolved] = useState(null); // { idHex, tokenAddress, owner?, housingValue }

  const [tokenInfo, setTokenInfo] = useState(null); // {decimals, name, symbol, totalSupply, myBalance}
  const [listing, setListing] = useState(null);     // {owner, decimals_, housingValue, remainingUnits, active}
  const [buyAmount, setBuyAmount] = useState("10");

  const idUpper = useMemo(() => (idHex || "").trim().toUpperCase(), [idHex]);
  const idLooksValid = /^[0-9A-F]{6}$/.test(idUpper);

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
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [SAPPHIRE_TESTNET] });
      } else {
        throw e;
      }
    }
  }, []);

  const connect = useCallback(async () => {
    setStatus("Connecting wallet…");
    setError(""); setWarn("");
    await ensureSapphire();
    const provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    setAccount(await signer.getAddress());
    setStatus("Connected");
  }, [ensureSapphire]);

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

  async function resolveId() {
    try {
      setStatus("Resolving ID…"); setError(""); setWarn("");
      if (!idLooksValid) throw new Error("Enter a valid 6-hex property ID.");

      const res = await fetch(`/api/vault/resolve?id=${idUpper}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      if (!data?.idHex || !isAddress(data?.tokenAddress)) {
        throw new Error("ID not found or tokenAddress missing in data/id.json");
      }
      if (!isAddress(data?.owner || "")) {
        setWarn("Owner not set in id.json. Deposit will use your connected wallet as owner.");
      }

      setResolved(data);
      setStatus("Resolved. Loading token & listing…");

      const provider = new BrowserProvider(window.ethereum);
      const erc20 = new Contract(data.tokenAddress, ERC20_ABI, provider);
      const [decimals, name, symbol, totalSupply, myBalance] = await Promise.all([
        erc20.decimals(),
        erc20.name(),
        erc20.symbol(),
        erc20.totalSupply(),
        account ? erc20.balanceOf(account) : 0n,
      ]);

      setTokenInfo({
        decimals: Number(decimals),
        name, symbol,
        totalSupply: totalSupply.toString(),
        myBalance: myBalance.toString(),
      });

      const vault = new Contract(VAULT_ADDRESS, VAULT_ABI, provider);
      try {
        const lst = await vault.getListing(data.tokenAddress);
        setListing({
          owner: lst.owner,
          decimals_: Number(lst.decimals_),
          housingValue: lst.housingValue.toString(),
          remainingUnits: lst.remainingUnits.toString(),
          active: Boolean(lst.active),
        });
      } catch {
        setListing(null);
        setWarn((w) => w || "No active listing found in vault yet.");
      }

      setStatus("Ready.");
    } catch (e) {
      console.error(e);
      setError(e.message || "Resolve failed");
      setStatus("");
    }
  }

  // priceWei = (amountRaw * housingValue) / 1e6
  function computePriceWei(amountTokensRaw, housingValue) {
    const hv = BigInt(housingValue || 0);
    return (amountTokensRaw * hv) / 1_000_000n;
  }

  async function approveAndDepositAll() {
    try {
      if (!resolved) throw new Error("Resolve an ID first.");
      if (!account) throw new Error("Connect wallet first.");
      if (!tokenInfo) throw new Error("Token info not loaded.");

      setStatus("Approving & depositing…"); setError(""); setWarn("");

      const ownerForDeposit = isAddress(resolved.owner || "") ? resolved.owner : account;

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const erc20 = new Contract(resolved.tokenAddress, ERC20_ABI, signer);
      const decimals = tokenInfo.decimals;
      const myBal = BigInt(tokenInfo.myBalance);
      if (myBal === 0n) throw new Error("You have 0 balance to deposit.");

      // Ensure allowance
      const currentAllowance = await erc20.allowance(account, VAULT_ADDRESS);
      if (currentAllowance < myBal) {
        const txA = await erc20.approve(VAULT_ADDRESS, myBal);
        await txA.wait();
      }

      const vault = new Contract(VAULT_ADDRESS, VAULT_ABI, signer);
      const hv = BigInt(resolved.housingValue || 0);

      // Convert to whole tokens for depositTokens call
      const wholeTokens = myBal / BigInt(10 ** decimals);

      const tx = await vault.depositTokens(ownerForDeposit, resolved.tokenAddress, hv, wholeTokens);
      const rc = await tx.wait();

      setStatus(`Deposited ${formatUnits(myBal, decimals)} ${tokenInfo.symbol}. Tx: ${rc.hash}`);

      // Refresh listing
      try {
        const lst = await new Contract(VAULT_ADDRESS, VAULT_ABI, provider).getListing(resolved.tokenAddress);
        setListing({
          owner: lst.owner,
          decimals_: Number(lst.decimals_),
          housingValue: lst.housingValue.toString(),
          remainingUnits: lst.remainingUnits.toString(),
          active: Boolean(lst.active),
        });
      } catch {}
    } catch (e) {
      console.error(e);
      setError(e.message || "Deposit failed");
      setStatus("");
    }
  }

  async function buyNow() {
    try {
      // Strong guards (also prevents Enter-submit when button is disabled)
      if (!resolved) throw new Error("Resolve an ID first.");
      if (!account) throw new Error("Connect wallet first.");
      if (!listing || !listing.active) throw new Error("No active listing found in vault. Deposit first.");

      const buyAmt = (buyAmount || "").trim();
      if (!/^\d+(\.\d+)?$/.test(buyAmt)) throw new Error("Enter a numeric amount to buy.");

      const amountTokens = parseInt(buyAmt);
      if (amountTokens <= 0 || amountTokens > 100) throw new Error("Amount must be between 1 and 100 whole tokens.");

      const ownerForBuy = isAddress(listing?.owner || "")
        ? listing.owner
        : (isAddress(resolved.owner || "") ? resolved.owner : null);
      if (!ownerForBuy) throw new Error("Owner unknown; cannot proceed with buy.");

      // Calculate price using the contract formula: (housingValue * 1e18 * amountTokens) / 1_000_000
      const housingValue = BigInt(listing.housingValue);
      const priceWei = (housingValue * BigInt(1e18) * BigInt(amountTokens)) / BigInt(1_000_000);
      
      if (priceWei <= 0n) throw new Error("Calculated price is 0; check listing housingValue.");

      setStatus(`Buying ${amountTokens} tokens for ${formatUnits(priceWei, 18)} TEST…`);
      setError(""); setWarn("");

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Use the contract directly with proper parameters
      const vault = new Contract(VAULT_ADDRESS, VAULT_ABI, signer);
      
      const tx = await vault.buyToken(amountTokens, priceWei, ownerForBuy, {
        value: priceWei,
      });
      
      const rc = await tx.wait();

      setStatus(`Purchased ${amountTokens} tokens! Tx: ${rc.hash}`);

      // Refresh listing
      try {
        const lst = await new Contract(VAULT_ADDRESS, VAULT_ABI, provider).getListing(resolved.tokenAddress);
        setListing({
          owner: lst.owner,
          decimals_: Number(lst.decimals_),
          housingValue: lst.housingValue.toString(),
          remainingUnits: lst.remainingUnits.toString(),
          active: Boolean(lst.active),
        });
      } catch {}
    } catch (e) {
      console.error(e);
      const msg =
        e?.info?.error?.message ||
        e?.shortMessage ||
        e?.reason ||
        e?.message ||
        String(e);
      setError(msg);
      setStatus("");
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 24, fontFamily: "system-ui" }}>
      <h1>Vault Tester (Deposit & Buy)</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Vault: <a href={`https://explorer.oasis.io/testnet/sapphire/address/${VAULT_ADDRESS}`} target="_blank" rel="noreferrer">{VAULT_ADDRESS}</a>
      </p>

      <div style={{ margin: "12px 0" }}>
        {account ? (
          <div><strong>Connected:</strong> {account}</div>
        ) : (
          <button onClick={connect}>Connect Wallet</button>
        )}
      </div>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginTop: 8 }}>
        <h3>1) Resolve Property</h3>
        <form
          onSubmit={(e) => { e.preventDefault(); resolveId(); }}
          style={{ display: "grid", gap: 8, maxWidth: 480 }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span><b>Property ID (6-hex)</b></span>
            <input value={idHex} onChange={(e) => setIdHex(e.target.value)} placeholder="e.g. B9F4B5" style={{ textTransform: "uppercase" }} />
          </label>
          <button type="submit" disabled={!idLooksValid}>Resolve</button>
        </form>

        {resolved && (
          <div style={{ marginTop: 12, display: "grid", gap: 4 }}>
            <div><b>ID:</b> {resolved.idHex}</div>
            <div><b>Token:</b> <a href={`https://explorer.oasis.io/testnet/sapphire/address/${resolved.tokenAddress}`} target="_blank" rel="noreferrer">{resolved.tokenAddress}</a></div>
            <div>
              <b>Owner:</b>{" "}
              {isAddress(resolved.owner || "")
                ? resolved.owner
                : <em style={{ opacity: 0.8 }}>(not set — will use your connected wallet for deposit)</em>}
            </div>
            <div><b>HousingValue:</b> {resolved.housingValue}</div>
          </div>
        )}

        {tokenInfo && (
          <div style={{ marginTop: 12, display: "grid", gap: 4 }}>
            <div><b>Token:</b> {tokenInfo.name} ({tokenInfo.symbol})</div>
            <div><b>Decimals:</b> {tokenInfo.decimals}</div>
            <div><b>Total Supply:</b> {formatUnits(BigInt(tokenInfo.totalSupply), tokenInfo.decimals)}</div>
            <div><b>Your Balance:</b> {formatUnits(BigInt(tokenInfo.myBalance), tokenInfo.decimals)}</div>
          </div>
        )}

        {listing && (
          <div style={{ marginTop: 12, display: "grid", gap: 4 }}>
            <div><b>Listing Owner:</b> {listing.owner}</div>
            <div><b>Listing Decimals:</b> {listing.decimals_}</div>
            <div><b>Listing HousingValue:</b> {listing.housingValue}</div>
            <div><b>Remaining Units:</b> {formatUnits(BigInt(listing.remainingUnits), listing.decimals_ || 18)}</div>
            <div><b>Active:</b> {listing.active ? "Yes" : "No"}</div>
          </div>
        )}
      </section>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginTop: 12 }}>
        <h3>2) Deposit (owner)</h3>
        <p style={{ marginTop: 0, opacity: 0.8 }}>
          Approves the vault and deposits <b>your entire balance</b> (e.g. the 100 tokens minted). If no owner is set in <code>id.json</code>, your connected wallet is used.
        </p>
        <button onClick={approveAndDepositAll} disabled={!resolved || !account}>
          Approve + Deposit All
        </button>
      </section>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginTop: 12 }}>
        <h3>3) Buy</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // Double-guard: block submit if listing not active
            if (!listing || !listing.active) {
              setError("No active listing found in vault. Deposit first.");
              return;
            }
            buyNow();
          }}
          style={{ display: "grid", gap: 8, maxWidth: 420 }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span><b>Amount to buy (whole tokens, 1-100)</b></span>
            <input 
              value={buyAmount} 
              onChange={(e) => setBuyAmount(e.target.value)} 
              placeholder="e.g. 10"
              type="number"
              min="1"
              max="100"
              step="1"
            />
          </label>
          <button type="submit" disabled={!resolved || !account || !listing || !listing.active}>
            Buy Now
          </button>
        </form>
        {resolved && listing && listing.active && (
          <div style={{ marginTop: 8, opacity: 0.8 }}>
            {(() => {
              try {
                const amountTokens = parseInt(buyAmount || "0");
                if (amountTokens > 0 && amountTokens <= 100) {
                  const housingValue = BigInt(listing.housingValue);
                  const priceWei = (housingValue * BigInt(1e18) * BigInt(amountTokens)) / BigInt(1_000_000);
                  return <div><b>Price Preview:</b> {formatUnits(priceWei, 18)} TEST</div>;
                }
                return null;
              } catch { return null; }
            })()}
          </div>
        )}
      </section>

      {status && <p style={{ marginTop: 12 }}><b>Status:</b> {status}</p>}
      {warn && <p style={{ marginTop: 12, color: "#b7791f" }}><b>Warning:</b> {warn}</p>}
      {error && <p style={{ marginTop: 12, color: "crimson" }}><b>Error:</b> {error}</p>}
    </main>
  );
}