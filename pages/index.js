// pages/login.js
import { useState, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/router";

export default function Login() {
  const { address, isConnected } = useAccount();
  const router = useRouter();

  const [imagePreview, setImagePreview] = useState(null);
  const [mimeType, setMimeType] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  // internal: keep parsed data but we don't render it
  const [parsedIC, setParsedIC] = useState(null);

  // prevent duplicate auto-processing
  const autoProcessing = useRef(false);

  // Redirect if user already exists
  useEffect(() => {
    if (isConnected && address) {
      (async () => {
        try {
          const response = await fetch("/api/check-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress: address }),
          });
          const data = await response.json();
          if (data.exists) router.push("/home");
        } catch (err) {
          console.error("Error checking existing user:", err);
        }
      })();
    }
  }, [isConnected, address, router]);

  function handleFileChange(event) {
    setError("");
    setParsedIC(null);
    setSaveMessage("");

    const file = event.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/jpg", "image/png", "application/pdf"].includes(file.type)) {
      setError("Unsupported file type. Please use JPEG, PNG, or PDF.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result);
      setMimeType(file.type);
    };
    reader.readAsDataURL(file);
  }

  // Core parse (returns data instead of relying on state)
  async function parseIC(imageData, mt) {
    const resp = await fetch("/api/parse-ic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageData, mimeType: mt }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.message || "Failed to parse IC");
    return data.data; // { icNumber, ... }
  }

  // Core save
  async function saveUser(icNumber) {
    if (!isConnected || !address) {
      throw new Error("Please connect your wallet first.");
    }
    const resp = await fetch("/api/save-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: address, icNumber }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.message || "Failed to save user");
    return data;
  }

  // AUTO process: when a file is selected, parse + save (if wallet connected)
  useEffect(() => {
    (async () => {
      if (!imagePreview || !mimeType) return;
      if (autoProcessing.current) return;
      autoProcessing.current = true;

      setLoading(true);
      setError("");
      setSaveMessage("");

      try {
        const parsed = await parseIC(imagePreview, mimeType);
        setParsedIC(parsed);

        if (!parsed?.icNumber) {
          throw new Error("IC number not found in the document.");
        }

        if (isConnected && address) {
          await saveUser(parsed.icNumber);
          setSaveMessage("Saved successfully. Redirecting to home...");
          setTimeout(() => router.push("/home"), 1500);
        } else {
          setSaveMessage("IC parsed. Connect your wallet to finish saving.");
        }
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
        autoProcessing.current = false;
      }
    })();
  }, [imagePreview, mimeType, isConnected, address, router]);

  // —— Same style language as your Property Flow page ——
  const ui = {
    container: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: "24px 12px",
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
      padding: 40,
    },
    section: {
      border: "1px solid #e2e8f0",
      background: "#f8fafc",
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
    },
    label: { display: "block", marginBottom: 8, fontWeight: 600, color: "#374151" },
    input: {
      width: "100%",
      padding: "12px 16px",
      border: "2px solid #e5e7eb",
      borderRadius: 8,
      fontSize: 16,
      outline: "none",
      transition: "border-color 0.2s ease",
    },
    statusCard: {
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
      borderRadius: 8,
      padding: 16,
      marginTop: 16,
    },
    hint: { fontSize: 14, color: "#6b7280", marginTop: 8 },
  };

  return (
    <div style={ui.container}>
      <div style={ui.card}>
        {/* Header */}
        <div style={ui.header}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>Login / Sign up</h1>
          <p style={{ margin: "12px 0 0", fontSize: 18, opacity: 0.9 }}>
            Verify your identity and create your account
          </p>
        </div>

        <div style={ui.content}>
          {/* Wallet banner */}
          <div
            style={{
              background: isConnected ? "#ecfdf5" : "#fef3c7",
              border: `1px solid ${isConnected ? "#d1fae5" : "#fcd34d"}`,
              borderRadius: 8,
              padding: 16,
              marginBottom: 24,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {isConnected ? (
              <div>
                <div style={{ fontWeight: 600, color: "#065f46" }}>✅ Wallet Connected</div>
                <div style={{ fontSize: 14, color: "#047857", marginTop: 4 }}>
                  {address.slice(0, 6)}...{address.slice(-4)}
                </div>
              </div>
            ) : (
              <div style={{ color: "#92400e", fontWeight: 600 }}>
                Connect your wallet to finish saving after upload
              </div>
            )}
          </div>

          {/* Upload (auto processes after selection) */}
          <section style={ui.section}>
            <h3 style={{ marginTop: 0, marginBottom: 12, color: "#1f2937" }}>
              1) Upload Your IC (Auto-process)
            </h3>

            <label style={ui.label}>Choose File Image / PDF</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              onChange={handleFileChange}
              style={ui.input}
              disabled={loading}
            />
            <div style={ui.hint}>Supported formats: JPG, PNG, PDF. Max size: 10MB</div>

            {(error || saveMessage || loading) && (
              <div
                style={{
                  ...ui.statusCard,
                  background: error
                    ? "#fef2f2"
                    : saveMessage
                    ? "#ecfdf5"
                    : "#f8fafc",
                  border: `1px solid ${
                    error ? "#fecaca" : saveMessage ? "#d1fae5" : "#e2e8f0"
                  }`,
                  color: error ? "#dc2626" : saveMessage ? "#065f46" : "#374151",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {loading && (
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      border: "2px solid #e5e7eb",
                      borderTop: "2px solid #667eea",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin 1s linear infinite",
                    }}
                  />
                )}
                {error ? error : saveMessage || "Processing…"}
              </div>
            )}
          </section>

          <div style={{ ...ui.hint, marginTop: 16 }}>
            After you choose a file, we’ll automatically parse and save your details.
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        input:focus {
          border-color: #667eea !important;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
      `}</style>
    </div>
  );
}