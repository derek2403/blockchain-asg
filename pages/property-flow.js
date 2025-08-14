// pages/property-flow.js
import { useCallback, useEffect, useState } from "react";
import { BrowserProvider, Contract, Interface, ZeroAddress, isAddress } from "ethers";
import { wrapEthersSigner } from "@oasisprotocol/sapphire-ethers-v6";

// Contract addresses and ABIs
const CONTRACT_ADDRESS = "0x594794c9ba0BaEC3e9610a1652BF82BD5Bb89d52";
const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS || "0x00cAe9ED35dCdf0F5C14c5EC11797E8c4d3dBB52";
const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS || "0xe7533E80B13e34092873257Af615A0A72a3A8367";

const STORAGE_ABI = [
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
];

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

const SAPPHIRE_TESTNET = {
  chainId: "0x5aff", // 23295
  chainName: "Oasis Sapphire Testnet",
  nativeCurrency: { name: "Sapphire Test ROSE", symbol: "TEST", decimals: 18 },
  rpcUrls: ["https://testnet.sapphire.oasis.io"],
  blockExplorerUrls: ["https://explorer.oasis.io/testnet/sapphire"],
};

export default function PropertyFlowPage() {
  // Step tracking
  const [currentStep, setCurrentStep] = useState(1); // 1=List, 2=Upload, 3=Complete
  
  // Common state
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Step 1: List Property state
  const [deedFile, setDeedFile] = useState(null);
  const [propertyId, setPropertyId] = useState("");
  const [encryptedData, setEncryptedData] = useState("");
  const [listTxHash, setListTxHash] = useState("");
  const [extractedFields, setExtractedFields] = useState(null);
  
  // Step 2: Upload Images & Mint state
  const [housingValue, setHousingValue] = useState("");
  const [images, setImages] = useState([]);
  const [mintTxHash, setMintTxHash] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [depositTxHash, setDepositTxHash] = useState("");

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
    setStatus("Connected successfully");
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

  // Step 1: List Property (parse deed and store encrypted data)
  const handleListProperty = async (e) => {
    e.preventDefault();
    if (!account) return alert("Please connect your wallet first");
    if (!deedFile) return alert("Please select a land deed image");

    try {
      setIsLoading(true);
      setStatus("Processing land deed with AI vision...");

      const fd = new FormData();
      fd.append("image", deedFile);
      fd.append("owner", account);

      const res = await fetch("/api/property-flow", { 
        method: "POST", 
        headers: { "x-action": "parse-deed" },
        body: fd
      });
      
      if (!res.ok) {
        const m = await res.text();
        throw new Error(m || "Failed to parse land deed");
      }

      const { id, idHex, encrypted, fields } = await res.json();
      setPropertyId(idHex);
      setEncryptedData(encrypted);
      setExtractedFields(fields);

      setStatus("Publishing encrypted data to Oasis Sapphire blockchain...");
      const provider = new BrowserProvider(window.ethereum);
      const signer = wrapEthersSigner(await provider.getSigner());

      const code = await provider.getCode(CONTRACT_ADDRESS);
      if (!code || code === "0x" || code === "0x0") {
        throw new Error("Smart contract not deployed on Sapphire Testnet");
      }

      const contract = new Contract(CONTRACT_ADDRESS, STORAGE_ABI, signer);
      const populated = await contract.store.populateTransaction(BigInt(id), encrypted);
      
      if (!populated?.data) throw new Error("Failed to prepare blockchain transaction");

      const sent = await signer.sendTransaction({
        to: CONTRACT_ADDRESS,
        data: populated.data,
      });
      setStatus("Waiting for blockchain confirmation...");
      const receipt = await sent.wait();
      setListTxHash(receipt?.hash || sent?.hash);

      // Save ID to backend
      setStatus("Saving property record...");
      const saveRes = await fetch("/api/property-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-action": "save-id" },
        body: JSON.stringify({ idHex, owner: account }),
      });
      
      if (!saveRes.ok) {
        console.warn("Warning: Could not save property ID:", await saveRes.text());
      }

      setStatus("Property successfully listed on blockchain! ✅");
      setTimeout(() => setCurrentStep(2), 1500);
    } catch (err) {
      console.error(err);
      setStatus(`❌ Error: ${err.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Upload Images, Set Housing Value, Mint Token, Deposit to Vault
  const handleUploadAndMint = async (e) => {
    e.preventDefault();
    if (!account) return alert("Please connect your wallet first");
    if (!propertyId) return alert("No property ID from previous step");
    if (images.length === 0 && !housingValue.trim()) {
      return alert("Please add at least one image or enter a housing value");
    }

    try {
      setIsLoading(true);
      setStatus("Uploading property images and housing value...");

      const fd = new FormData();
      fd.append("idHex", propertyId);
      fd.append("owner", account);
      fd.append("housingValue", housingValue.trim());
      for (const img of images.slice(0, 3)) {
        fd.append("images", img);
      }

      const uploadRes = await fetch("/api/upload", { 
        method: "POST", 
        body: fd
      });
      
      if (!uploadRes.ok) throw new Error(await uploadRes.text());
      
      setStatus("Minting ERC20 property tokens...");
      const provider = new BrowserProvider(window.ethereum);
      const signer = wrapEthersSigner(await provider.getSigner());

      // Check if token already exists
      const factoryRead = new Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
      let tokenAddr;
      try {
        tokenAddr = await factoryRead.tokenOf(propertyId);
        if (tokenAddr && tokenAddr !== ZeroAddress) {
          setStatus("Property token already exists, using existing token...");
          setTokenAddress(tokenAddr);
        }
      } catch {
        // Need to mint new token
      }

      if (!tokenAddr || tokenAddr === ZeroAddress) {
        const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
        const mintTx = await factory.mintToken(propertyId);
        setMintTxHash(mintTx.hash);
        setStatus("Waiting for token creation confirmation...");
        const mintReceipt = await mintTx.wait();

        // Get token address from contract
        try {
          tokenAddr = await factoryRead.tokenOf(propertyId);
        } catch {}

        if (!tokenAddr || tokenAddr === ZeroAddress) {
          // Fallback to event parsing
          const iface = new Interface(FACTORY_ABI);
          for (const log of mintReceipt.logs) {
            try {
              const parsed = iface.parseLog(log);
              if (parsed?.name === "TokenCreated") {
                tokenAddr = parsed.args?.token;
                break;
              }
            } catch {}
          }
        }

        if (!tokenAddr || tokenAddr === ZeroAddress) {
          throw new Error("Token minted successfully but address not found");
        }
        setTokenAddress(tokenAddr);
      }

      // Save token address to backend
      const tokenSaveRes = await fetch("/api/upload", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idHex: propertyId, tokenAddress: tokenAddr, owner: account }),
      });
      if (!tokenSaveRes.ok) {
        console.warn("Warning: Could not save token address:", await tokenSaveRes.text());
      }

      setStatus("Approving and depositing tokens to vault...");
      
      // Get token balance and approve vault
      const erc20 = new Contract(tokenAddr, ERC20_ABI, signer);
      const decimals = Number(await erc20.decimals());
      const balance = BigInt(await erc20.balanceOf(account).then(b => b.toString()));
      
      if (balance === 0n) {
        setStatus("✅ Token created successfully! No tokens to deposit.");
        setCurrentStep(3);
        return;
      }

      // Approve vault to spend tokens
      const allowance = BigInt(await erc20.allowance(account, VAULT_ADDRESS).then(a => a.toString()));
      if (allowance < balance) {
        setStatus("Approving vault to manage your tokens...");
        const approveTx = await erc20.approve(VAULT_ADDRESS, balance);
        await approveTx.wait();
      }

      // Deposit all tokens to vault
      const wholeTokens = balance / (BigInt(10) ** BigInt(decimals));
      if (wholeTokens > 0n) {
        setStatus("Depositing tokens to fractional ownership vault...");
        const vault = new Contract(VAULT_ADDRESS, VAULT_ABI, signer);
        const housingValueBN = BigInt((housingValue || "0").trim() || "0");
        const depositTx = await vault.depositTokens(account, tokenAddr, housingValueBN, wholeTokens);
        const depositReceipt = await depositTx.wait();
        setDepositTxHash(depositReceipt.hash);
        setStatus(`🎉 Successfully deposited ${wholeTokens.toString()} tokens to vault!`);
      } else {
        setStatus("✅ Process completed successfully!");
      }

      setTimeout(() => setCurrentStep(3), 1500);
    } catch (err) {
      console.error(err);
      setStatus(`❌ Error: ${err.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resetFlow = () => {
    setCurrentStep(1);
    setDeedFile(null);
    setPropertyId("");
    setEncryptedData("");
    setListTxHash("");
    setExtractedFields(null);
    setHousingValue("");
    setImages([]);
    setMintTxHash("");
    setTokenAddress("");
    setDepositTxHash("");
    setStatus("");
  };

  const stepStyles = {
    container: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    card: {
      maxWidth: 900,
      margin: "0 auto",
      background: "white",
      borderRadius: 16,
      boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
      overflow: "hidden",
    },
    header: {
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "white",
      padding: "40px 40px 50px",
      textAlign: "center",
    },
    content: {
      padding: "40px",
    },
    progressBar: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 40,
      position: "relative",
    },
    progressStep: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      flex: 1,
      position: "relative",
    },
    progressCircle: {
      width: 50,
      height: 50,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: "bold",
      marginBottom: 8,
      transition: "all 0.3s ease",
    },
    progressLine: {
      position: "absolute",
      top: 25,
      left: "50%",
      width: "100%",
      height: 3,
      zIndex: -1,
    },
    formGroup: {
      marginBottom: 24,
    },
    label: {
      display: "block",
      marginBottom: 8,
      fontWeight: 600,
      color: "#374151",
    },
    input: {
      width: "100%",
      padding: "12px 16px",
      border: "2px solid #e5e7eb",
      borderRadius: 8,
      fontSize: 16,
      transition: "border-color 0.3s ease",
      outline: "none",
    },
    button: {
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "white",
      border: "none",
      padding: "14px 32px",
      borderRadius: 8,
      fontSize: 16,
      fontWeight: 600,
      cursor: "pointer",
      transition: "all 0.3s ease",
      minWidth: 200,
    },
    statusCard: {
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
      borderRadius: 8,
      padding: 16,
      marginTop: 20,
    },
    linkButton: {
      color: "#667eea",
      textDecoration: "none",
      fontWeight: 500,
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
    }
  };

  return (
    <div style={stepStyles.container}>
      <div style={stepStyles.card}>
        {/* Header */}
        <div style={stepStyles.header}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>
            Property Tokenization Platform
          </h1>
          <p style={{ margin: "12px 0 0", fontSize: 18, opacity: 0.9 }}>
            Transform your real estate into digital assets on the blockchain
          </p>
        </div>

        <div style={stepStyles.content}>
          {/* Progress Bar */}
          <div style={stepStyles.progressBar}>
            {[1, 2, 3].map((step, index) => (
              <div key={step} style={stepStyles.progressStep}>
                {index > 0 && (
                  <div style={{
                    ...stepStyles.progressLine,
                    background: currentStep > step - 1 ? "#667eea" : "#e5e7eb"
                  }} />
                )}
                <div style={{
                  ...stepStyles.progressCircle,
                  background: currentStep >= step ? "#667eea" : "#e5e7eb",
                  color: currentStep >= step ? "white" : "#9ca3af",
                }}>
                  {step}
                </div>
                <span style={{ 
                  fontSize: 14, 
                  fontWeight: 500,
                  color: currentStep >= step ? "#667eea" : "#9ca3af"
                }}>
                  {step === 1 ? "List Property" : step === 2 ? "Upload & Mint" : "Complete"}
                </span>
              </div>
            ))}
          </div>

          {/* Wallet Connection */}
          <div style={{ 
            background: account ? "#ecfdf5" : "#fef3c7", 
            border: `1px solid ${account ? "#d1fae5" : "#fcd34d"}`,
            borderRadius: 8,
            padding: 16,
            marginBottom: 32,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            {account ? (
              <>
                <div>
                  <span style={{ fontWeight: 600, color: "#065f46" }}>✅ Wallet Connected</span>
                  <div style={{ fontSize: 14, color: "#047857", marginTop: 4 }}>
                    {account.slice(0, 6)}...{account.slice(-4)}
                  </div>
                </div>
              </>
            ) : (
              <>
                <span style={{ fontWeight: 600, color: "#92400e" }}>Connect your wallet to continue</span>
                <button 
                  onClick={connect}
                  style={{
                    ...stepStyles.button,
                    minWidth: "auto",
                    padding: "8px 16px",
                    fontSize: 14
                  }}
                >
                  Connect Wallet
                </button>
              </>
            )}
          </div>

          {/* Step Content */}
          {currentStep === 1 && (
            <div>
              <h2 style={{ marginBottom: 20, color: "#1f2937" }}>Step 1: List Your Property</h2>
              <p style={{ color: "#6b7280", marginBottom: 32 }}>
                Upload your Malaysian land deed document. Our AI will extract property details and generate a unique blockchain identifier.
              </p>
              
              <form onSubmit={handleListProperty}>
                <div style={stepStyles.formGroup}>
                  <label style={stepStyles.label}>Land Deed Document (Image)</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => setDeedFile(e.target.files?.[0] || null)}
                    style={{
                      ...stepStyles.input,
                      borderColor: deedFile ? "#10b981" : "#e5e7eb"
                    }}
                    disabled={isLoading}
                  />
                  <p style={{ fontSize: 14, color: "#6b7280", marginTop: 8 }}>
                    Supported formats: JPG, PNG, WEBP. Max size: 10MB
                  </p>
                </div>
                
                <button 
                  type="submit" 
                  disabled={!account || !deedFile || isLoading}
                  style={{
                    ...stepStyles.button,
                    opacity: (!account || !deedFile || isLoading) ? 0.6 : 1,
                    cursor: (!account || !deedFile || isLoading) ? "not-allowed" : "pointer"
                  }}
                >
                  {isLoading ? "Processing..." : "🚀 Parse & List Property"}
                </button>
              </form>

              {extractedFields && (
                <div style={{
                  ...stepStyles.statusCard,
                  background: "#ecfdf5",
                  border: "1px solid #d1fae5",
                  marginTop: 24
                }}>
                  <h4 style={{ margin: "0 0 12px", color: "#065f46" }}>✅ Extracted Property Details</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                    <div><strong>Property ID:</strong> {propertyId}</div>
                    <div><strong>No. Hakmilik:</strong> {extractedFields.NoHakmilik}</div>
                    <div><strong>No. Bangunan:</strong> {extractedFields.NoBangunan}</div>
                    <div><strong>No. Tingkat:</strong> {extractedFields.NoTingkat}</div>
                    <div><strong>No. Petak:</strong> {extractedFields.NoPetak}</div>
                    <div><strong>Negeri:</strong> {extractedFields.Negeri}</div>
                    <div><strong>Daerah:</strong> {extractedFields.Daerah}</div>
                    <div><strong>Bandar:</strong> {extractedFields.Bandar}</div>
                  </div>
                  {listTxHash && (
                    <div style={{ marginTop: 12 }}>
                      <strong>Blockchain Transaction:</strong>{" "}
                      <a 
                        href={`https://explorer.oasis.io/testnet/sapphire/tx/${listTxHash}`} 
                        target="_blank" 
                        rel="noreferrer"
                        style={stepStyles.linkButton}
                      >
                        View on Explorer ↗
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h2 style={{ marginBottom: 20, color: "#1f2937" }}>Step 2: Add Property Assets & Tokenize</h2>
              <p style={{ color: "#6b7280", marginBottom: 32 }}>
                Upload property images, set housing value, and create tradeable tokens for fractional ownership.
              </p>
              
              <div style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: 16,
                marginBottom: 24
              }}>
                <strong style={{ color: "#1f2937" }}>Property ID: {propertyId}</strong>
              </div>
              
              <form onSubmit={handleUploadAndMint}>
                <div style={stepStyles.formGroup}>
                  <label style={stepStyles.label}>Housing Value (MYR)</label>
                  <input
                    type="number"
                    placeholder="e.g., 650000"
                    value={housingValue}
                    onChange={(e) => setHousingValue(e.target.value)}
                    style={stepStyles.input}
                    disabled={isLoading}
                  />
                </div>

                <div style={stepStyles.formGroup}>
                  <label style={stepStyles.label}>Property Images (Maximum 3)</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setImages(files.slice(0, 3));
                    }}
                    style={{
                      ...stepStyles.input,
                      borderColor: images.length > 0 ? "#10b981" : "#e5e7eb"
                    }}
                    disabled={isLoading}
                  />
                  <p style={{ fontSize: 14, color: "#6b7280", marginTop: 8 }}>
                    Selected: {images.length} image{images.length !== 1 ? "s" : ""} • JPG, PNG, WEBP formats
                  </p>
                </div>
                
                <button 
                  type="submit" 
                  disabled={!account || !propertyId || isLoading}
                  style={{
                    ...stepStyles.button,
                    opacity: (!account || !propertyId || isLoading) ? 0.6 : 1,
                    cursor: (!account || !propertyId || isLoading) ? "not-allowed" : "pointer"
                  }}
                >
                  {isLoading ? "Processing..." : "🪙 Mint Tokens & Deposit to Vault"}
                </button>
              </form>
            </div>
          )}

          {currentStep === 3 && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
              <h2 style={{ color: "#1f2937", marginBottom: 16 }}>Tokenization Complete!</h2>
              <p style={{ color: "#6b7280", marginBottom: 32, fontSize: 18 }}>
                Your property has been successfully tokenized and is now available for fractional ownership.
              </p>
              
              <div style={{ 
                display: "grid", 
                gap: 16, 
                marginBottom: 32,
                textAlign: "left",
                background: "#f8fafc",
                padding: 24,
                borderRadius: 12,
                border: "1px solid #e2e8f0"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600 }}>Property ID:</span>
                  <span style={{ fontFamily: "monospace" }}>{propertyId}</span>
                </div>
                
                {tokenAddress && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600 }}>Token Contract:</span>
                    <a 
                      href={`https://explorer.oasis.io/testnet/sapphire/address/${tokenAddress}`} 
                      target="_blank" 
                      rel="noreferrer"
                      style={stepStyles.linkButton}
                    >
                      {tokenAddress.slice(0, 8)}...{tokenAddress.slice(-6)} ↗
                    </a>
                  </div>
                )}
                
                {mintTxHash && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600 }}>Mint Transaction:</span>
                    <a 
                      href={`https://explorer.oasis.io/testnet/sapphire/tx/${mintTxHash}`} 
                      target="_blank" 
                      rel="noreferrer"
                      style={stepStyles.linkButton}
                    >
                      {mintTxHash.slice(0, 8)}...{mintTxHash.slice(-6)} ↗
                    </a>
                  </div>
                )}
                
                {depositTxHash && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600 }}>Vault Deposit:</span>
                    <a 
                      href={`https://explorer.oasis.io/testnet/sapphire/tx/${depositTxHash}`} 
                      target="_blank" 
                      rel="noreferrer"
                      style={stepStyles.linkButton}
                    >
                      {depositTxHash.slice(0, 8)}...{depositTxHash.slice(-6)} ↗
                    </a>
                  </div>
                )}
              </div>

              <button 
                onClick={resetFlow} 
                style={{
                  ...stepStyles.button,
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                }}
              >
                🏠 Tokenize Another Property
              </button>
            </div>
          )}

          {/* Status Display */}
          {status && (
            <div style={{
              ...stepStyles.statusCard,
              background: status.includes("❌") ? "#fef2f2" : status.includes("✅") || status.includes("🎉") ? "#ecfdf5" : "#f8fafc",
              border: `1px solid ${status.includes("❌") ? "#fecaca" : status.includes("✅") || status.includes("🎉") ? "#d1fae5" : "#e2e8f0"}`,
              color: status.includes("❌") ? "#dc2626" : status.includes("✅") || status.includes("🎉") ? "#065f46" : "#374151"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {isLoading && (
                  <div style={{
                    width: 16,
                    height: 16,
                    border: "2px solid #e5e7eb",
                    borderTop: "2px solid #667eea",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite"
                  }} />
                )}
                <strong>Status:</strong> {status}
              </div>
            </div>
          )}

          {/* Information Panel */}
          <details style={{ 
            marginTop: 32,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: 16
          }}>
            <summary style={{ 
              fontWeight: 600, 
              cursor: "pointer",
              color: "#374151",
              marginBottom: 12
            }}>
              ℹ️ How Property Tokenization Works
            </summary>
            <div style={{ 
              fontSize: 14, 
              lineHeight: 1.6,
              color: "#6b7280",
              marginTop: 12
            }}>
              <div style={{ marginBottom: 12 }}>
                <strong>1. AI Document Processing:</strong> Our system uses Google Gemini AI to extract key property details from your land deed, including No. Hakmilik, building details, and location information.
              </div>
              <div style={{ marginBottom: 12 }}>
                <strong>2. Blockchain Storage:</strong> Property data is encrypted and stored permanently on the Oasis Sapphire blockchain, ensuring privacy and immutability.
              </div>
              <div style={{ marginBottom: 12 }}>
                <strong>3. Token Creation:</strong> An ERC-20 token representing your property is minted with 100 tokens total supply, enabling fractional ownership.
              </div>
              <div>
                <strong>4. Vault Deposit:</strong> All tokens are automatically deposited into a smart contract vault, making them available for fractional trading and investment.
              </div>
            </div>
          </details>
        </div>
      </div>

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        input:focus {
          border-color: #667eea !important;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.15);
        }
        
        button:disabled {
          cursor: not-allowed;
        }
        
        a:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}