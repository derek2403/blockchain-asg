// pages/dividend.js
import { useEffect, useState } from "react";

export default function DividendPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Form state
  const [idHex, setIdHex] = useState("");
  const [earningsAmount, setEarningsAmount] = useState("");
  
  // Data state
  const [tokenInfo, setTokenInfo] = useState(null); // {tokenAddress, owner, housingValue}
  const [holders, setHolders] = useState([]); // [{address, balance, percentage}]
  const [distributing, setDistributing] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const idUpper = (idHex || "").trim().toUpperCase();
  const idLooksValid = /^[0-9A-F]{6}$/.test(idUpper);

  const loadTokenInfo = async () => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      
      if (!idLooksValid) {
        throw new Error("Enter a valid 6-hex property ID");
      }

      const res = await fetch(`/api/dividend/get-token-info?id=${idUpper}`);
      if (!res.ok) throw new Error(await res.text());
      
      const data = await res.json();
      setTokenInfo(data);
      
      // Load holders (this may take a while for tokens with many transactions)
      setSuccess("Token info loaded. Fetching current token holders from blockchain...");
      
      const holdersRes = await fetch(`/api/dividend/get-holders?tokenAddress=${data.tokenAddress}`);
      if (!holdersRes.ok) {
        const errorText = await holdersRes.text();
        throw new Error(`Failed to fetch token holders: ${errorText}`);
      }
      
      const holdersData = await holdersRes.json();
      setHolders(holdersData.holders || []);
      
      if (holdersData.holders && holdersData.holders.length > 0) {
        setSuccess(`✅ Found ${holdersData.holders.length} token holders`);
      } else {
        setSuccess("⚠️ No token holders found. The token may not have been distributed yet.");
      }
      
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to load token info");
      setTokenInfo(null);
      setHolders([]);
    } finally {
      setLoading(false);
    }
  };

  const distributeDividends = async () => {
    try {
      if (!tokenInfo) throw new Error("Load token info first");
      if (!earningsAmount || isNaN(earningsAmount) || Number(earningsAmount) <= 0) {
        throw new Error("Enter a valid earnings amount");
      }
      if (holders.length === 0) throw new Error("No holders found");

      setDistributing(true);
      setError("");
      setSuccess("Starting dividend distribution...");

      console.log("Starting distribution with data:", {
        earningsAmount: earningsAmount,
        holders: holders,
      });

      const res = await fetch("/api/dividend/distribute", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache"
        },
        body: JSON.stringify({
          earningsAmount: earningsAmount,
          holders: holders,
          timestamp: new Date().toISOString() // Add timestamp to prevent caching
        }),
      });

      console.log("Distribution response status:", res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Distribution failed:", errorText);
        throw new Error(`Distribution failed: ${errorText}`);
      }
      
      const result = await res.json();
      console.log("Distribution result:", result);
      
      if (result.successCount > 0) {
        setSuccess(`✅ ${result.message || 'Distribution complete!'} Total: ${result.totalDistributed} TEST to ${result.successCount} holders.`);
      } else {
        setError(`❌ Distribution failed. ${result.errors ? result.errors.length : 0} errors occurred.`);
      }
      
      if (result.errors && result.errors.length > 0) {
        console.error("Distribution errors:", result.errors);
      }
      
    } catch (e) {
      console.error("Distribution error:", e);
      setError(e.message || "Distribution failed");
    } finally {
      setDistributing(false);
    }
  };

  const testDistribution = async () => {
    try {
      setTestResult("Testing distribution system...");
      
      const res = await fetch("/api/dividend/test");
      if (!res.ok) throw new Error(await res.text());
      
      const result = await res.json();
      setTestResult(result);
      
    } catch (e) {
      console.error("Test failed:", e);
      setTestResult({ error: e.message });
    }
  };

  const styled = {
    page: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: "40px 16px",
    },
    wrap: { maxWidth: 900, margin: "0 auto" },
    title: { margin: 0, fontSize: 28, fontWeight: 700, color: "#111827" },
    sub: { margin: "6px 0 24px", color: "#6b7280" },
    card: {
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 16,
      padding: 24,
      boxShadow: "0 10px 24px rgba(0,0,0,.06)",
      marginBottom: 24,
    },
    form: { display: "grid", gap: 16, maxWidth: 480 },
    label: { display: "grid", gap: 6 },
    labelText: { fontWeight: 600, color: "#374151" },
    input: { 
      padding: "12px 16px", 
      borderRadius: 8, 
      border: "1px solid #d1d5db", 
      fontSize: 14,
      transition: "border-color 0.15s ease",
    },
    button: { 
      background: "#111827", 
      color: "white", 
      border: 0, 
      padding: "12px 20px", 
      borderRadius: 8, 
      fontWeight: 600, 
      cursor: "pointer",
      fontSize: 14,
      transition: "background-color 0.15s ease",
    },
    buttonSecondary: {
      background: "#059669", 
      color: "white", 
      border: 0, 
      padding: "12px 20px", 
      borderRadius: 8, 
      fontWeight: 600, 
      cursor: "pointer",
      fontSize: 14,
      transition: "background-color 0.15s ease",
    },
    tokenInfo: {
      padding: 16,
      background: "#f0f9ff",
      borderRadius: 12,
      border: "1px solid #bae6fd",
      marginTop: 16,
    },
    holdersTable: {
      width: "100%",
      borderCollapse: "collapse",
      marginTop: 16,
    },
    th: {
      background: "#f9fafb",
      padding: "12px 16px",
      textAlign: "left",
      fontWeight: 600,
      color: "#374151",
      borderBottom: "1px solid #e5e7eb",
    },
    td: {
      padding: "12px 16px",
      borderBottom: "1px solid #f3f4f6",
      fontSize: 14,
    },
    status: { 
      marginTop: 16, 
      padding: 12, 
      borderRadius: 8, 
      fontWeight: 600,
    },
    error: { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" },
    success: { background: "#f0fdf4", color: "#059669", border: "1px solid #bbf7d0" },
  };

  return (
    <div style={styled.page}>
      <div style={styled.wrap}>
        <h1 style={styled.title}>Dividend Distribution</h1>
        <p style={styled.sub}>
          Distribute earnings to token holders based on their ownership percentage.
        </p>

        {/* Load Token Info */}
        <div style={styled.card}>
          <h3 style={{ margin: "0 0 16px 0", color: "#111827" }}>1. Load Property Token</h3>
          <form 
            onSubmit={(e) => { e.preventDefault(); loadTokenInfo(); }}
            style={styled.form}
          >
            <label style={styled.label}>
              <span style={styled.labelText}>Property ID (6-hex)</span>
              <input 
                value={idHex} 
                onChange={(e) => setIdHex(e.target.value)} 
                placeholder="e.g. B9F4B5" 
                style={{
                  ...styled.input,
                  textTransform: "uppercase",
                  borderColor: idLooksValid ? "#10b981" : "#d1d5db"
                }}
              />
            </label>
            <button 
              type="submit" 
              disabled={!idLooksValid || loading}
              style={{
                ...styled.button,
                opacity: (!idLooksValid || loading) ? 0.6 : 1,
                cursor: (!idLooksValid || loading) ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "Loading..." : "Load Token Info"}
            </button>
          </form>

          {tokenInfo && (
            <div style={styled.tokenInfo}>
              <h4 style={{ margin: "0 0 8px 0", color: "#374151" }}>Token Information</h4>
              <div style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>
                <div><strong>Property ID:</strong> {tokenInfo.idHex}</div>
                <div><strong>Token Address:</strong> {tokenInfo.tokenAddress}</div>
                <div><strong>Owner:</strong> {tokenInfo.owner}</div>
                <div><strong>Housing Value:</strong> {tokenInfo.housingValue}</div>
                <div><strong>Total Holders:</strong> {holders.length}</div>
              </div>
            </div>
          )}

          {holders.length > 0 && (
            <div>
              <h4 style={{ margin: "16px 0 8px 0", color: "#374151" }}>Token Holders</h4>
              <table style={styled.holdersTable}>
                <thead>
                  <tr>
                    <th style={styled.th}>Address</th>
                    <th style={styled.th}>Balance</th>
                    <th style={styled.th}>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {holders.map((holder, i) => (
                    <tr key={i}>
                      <td style={styled.td}>
                        {holder.address.slice(0, 6)}...{holder.address.slice(-4)}
                      </td>
                      <td style={styled.td}>{holder.balance}</td>
                      <td style={styled.td}>{holder.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Distribute Dividends */}
        {tokenInfo && holders.length > 0 && (
          <div style={styled.card}>
            <h3 style={{ margin: "0 0 16px 0", color: "#111827" }}>2. Distribute Dividends</h3>
            <form 
              onSubmit={(e) => { e.preventDefault(); distributeDividends(); }}
              style={styled.form}
            >
              <label style={styled.label}>
                <span style={styled.labelText}>Total Earnings Amount (TEST)</span>
                <input 
                  type="number"
                  step="0.000001"
                  min="0"
                  value={earningsAmount} 
                  onChange={(e) => setEarningsAmount(e.target.value)} 
                  placeholder="e.g. 100.5" 
                  style={styled.input}
                />
              </label>
              
              {earningsAmount && !isNaN(earningsAmount) && Number(earningsAmount) > 0 && (
                <div style={{ 
                  padding: 12, 
                  background: "#f0f9ff", 
                  borderRadius: 8, 
                  border: "1px solid #bae6fd",
                  fontSize: 14,
                  color: "#374151"
                }}>
                  <div><strong>Preview Distribution:</strong></div>
                  {holders.map((holder, i) => {
                    const amount = (Number(earningsAmount) * holder.percentage / 100).toFixed(6);
                    return (
                      <div key={i} style={{ marginTop: 4 }}>
                        {holder.address.slice(0, 6)}...{holder.address.slice(-4)}: {amount} TEST ({holder.percentage}%)
                      </div>
                    );
                  })}
                </div>
              )}

              <button 
                type="submit" 
                disabled={!earningsAmount || isNaN(earningsAmount) || Number(earningsAmount) <= 0 || distributing}
                style={{
                  ...styled.buttonSecondary,
                  opacity: (!earningsAmount || isNaN(earningsAmount) || Number(earningsAmount) <= 0 || distributing) ? 0.6 : 1,
                  cursor: (!earningsAmount || isNaN(earningsAmount) || Number(earningsAmount) <= 0 || distributing) ? "not-allowed" : "pointer"
                }}
              >
                {distributing ? "Distributing..." : "Distribute Dividends"}
              </button>
            </form>
          </div>
        )}

        {/* Test Section */}
        <div style={styled.card}>
          <h3 style={{ margin: "0 0 16px 0", color: "#111827" }}>Debug & Test</h3>
          <button onClick={testDistribution} style={styled.button}>
            Test Distribution System
          </button>
          
          {testResult && (
            <div style={{ 
              marginTop: 16, 
              padding: 12, 
              background: "#f9fafb", 
              borderRadius: 8, 
              border: "1px solid #e5e7eb",
              fontSize: 12,
              fontFamily: "monospace"
            }}>
              <pre>{JSON.stringify(testResult, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* Status Messages */}
        {error && (
          <div style={{ ...styled.status, ...styled.error }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ ...styled.status, ...styled.success }}>
            {success}
          </div>
        )}
      </div>

      <style jsx>{`
        input:focus {
          outline: none;
          border-color: #4f46e5 !important;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }
        button:hover:not(:disabled) {
          background-color: #374151 !important;
        }
        button[style*="background: #059669"]:hover:not(:disabled) {
          background-color: #047857 !important;
        }
        table tr:hover {
          background-color: #f9fafb;
        }
      `}</style>
    </div>
  );
}
