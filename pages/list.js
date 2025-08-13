import { useCallback, useEffect, useState } from "react";
import { BrowserProvider, Contract } from "ethers";
import { wrapEthersSigner } from "@oasisprotocol/sapphire-ethers-v6";

const CONTRACT_ADDRESS = "0x594794c9ba0BaEC3e9610a1652BF82BD5Bb89d52";
const ABI = [
  {
    anonymous: false,
    inputs: [{ indexed: true, internalType: "uint256", name: "id", type: "uint256" }],
    name: "Stored",
    type: "event",
  },
  {
    inputs: [{ internalType: "uint256", name: "id", type: "uint256" }],
    name: "get",
    outputs: [{ internalType: "string", name: "value", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "id", type: "uint256" },
      { internalType: "string", name: "value", type: "string" },
    ],
    name: "store",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const SAPPHIRE_TESTNET = {
  chainId: "0x5aff", // 23295
  chainName: "Oasis Sapphire Testnet",
  nativeCurrency: { name: "Sapphire Test ROSE", symbol: "TEST", decimals: 18 },
  rpcUrls: ["https://testnet.sapphire.oasis.io"],
  blockExplorerUrls: ["https://explorer.oasis.io/testnet/sapphire"],
};

export default function ListPropertyPage() {
  const [account, setAccount] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [lastIdHex, setLastIdHex] = useState(""); // 6-hex-digit for display
  const [lastEnc, setLastEnc] = useState("");
  const [txHash, setTxHash] = useState("");

  const ensureSapphire = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      throw new Error("No injected wallet found");
    }
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
    setStatus("Connecting wallet…");
    await ensureSapphire();

    const provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = wrapEthersSigner(await provider.getSigner());
    const addr = await signer.getAddress();
    setAccount(addr);
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

  const onFile = (e) => setFile(e.target.files?.[0] ?? null);

  const submit = async (e) => {
    e.preventDefault();
    if (!account) return alert("Connect wallet first");
    if (!file) return alert("Please select an image of the land deed");

    try {
      setStatus("Uploading & parsing with Gemini…");

      const fd = new FormData();
      fd.append("image", file);
      fd.append("owner", account);

      const res = await fetch("/api/parse-property", { method: "POST", body: fd });
      if (!res.ok) {
        const m = await res.text();
        throw new Error(m || "Parse failed");
      }

      // id = decimal for on-chain; idHex = 6-hex-digit for display & saving
      const { id, idHex, encrypted } = await res.json();
      setLastIdHex(String(idHex));
      setLastEnc(encrypted);

      setStatus("Preparing Oasis signer…");
      const provider = new BrowserProvider(window.ethereum);
      const signer = wrapEthersSigner(await provider.getSigner());

      // Verify the contract actually exists at the address
      setStatus("Checking contract bytecode…");
      const code = await provider.getCode(CONTRACT_ADDRESS);
      if (!code || code === "0x" || code === "0x0") {
        throw new Error("No contract code at address on Sapphire Testnet. Wrong address or network?");
      }

      const contract = new Contract(CONTRACT_ADDRESS, ABI, signer);

      // Populate and send
      setStatus("Publishing to Sapphire… requesting signature");
      const populated = await contract.store.populateTransaction(BigInt(id), encrypted);
      if (!populated?.data) throw new Error("Internal error: no tx data produced for contract call");

      const sent = await signer.sendTransaction({
        to: CONTRACT_ADDRESS,
        data: populated.data,
        // gasLimit: 200000, // optional
      });
      const receipt = await sent.wait();
      setTxHash(receipt?.hash || sent?.hash);

      // Persist ID (hex) to data/id.json via same API (JSON mode)
      setStatus("Saving ID…");
      const saveRes = await fetch("/api/parse-property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saveId: true, idHex }),
      });
      if (!saveRes.ok) {
        const msg = await saveRes.text();
        console.warn("Save ID error:", msg);
      }

      setStatus("Listed on-chain!");
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message || err}`);
    }
  };

  return (
    <main style={{ maxWidth: 680, margin: "40px auto", padding: 24, fontFamily: "system-ui" }}>
      <h1>List Property</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Upload your land deed image → parse fields with Gemini → encrypt & publish to Oasis Sapphire.
      </p>

      <div style={{ margin: "12px 0" }}>
        {account ? (
          <div>
            <strong>Owner (wallet):</strong> {account}
          </div>
        ) : (
          <button onClick={connect}>Connect Wallet</button>
        )}
      </div>

      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <input type="file" accept="image/*" onChange={onFile} />
        <button type="submit" disabled={!account || !file}>
          List Property
        </button>
      </form>

      {status && (
        <p style={{ marginTop: 16 }}>
          <strong>Status:</strong> {status}
        </p>
      )}

      {lastIdHex && (
        <div style={{ marginTop: 16 }}>
          <div>
            <strong>Generated ID (hex, 6):</strong> {lastIdHex}
          </div>
          <div style={{ wordBreak: "break-all" }}>
            <strong>Encrypted payload:</strong> {lastEnc}
          </div>
          {txHash && (
            <div style={{ marginTop: 8 }}>
              <strong>Tx:</strong> {txHash}
            </div>
          )}
        </div>
      )}

      <details style={{ marginTop: 16 }}>
        <summary>What gets encrypted?</summary>
        <code>
          {"{no hakmilik},{no.bangunan},{no.tingkat},{no.petak},{negeri}.{daerah},{bandar},{owner}"}
        </code>
      </details>
    </main>
  );
}