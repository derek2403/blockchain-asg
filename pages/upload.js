import { useEffect, useState } from "react";

export default function UploadPage() {
  const [loading, setLoading] = useState(true);
  const [ids, setIds] = useState([]);
  const [idHex, setIdHex] = useState("");
  const [housingValue, setHousingValue] = useState("");
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

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

  const submit = async (e) => {
    e.preventDefault();
    if (!idHex) return setStatus("Pick a property ID first.");
    if (files.length === 0 && !housingValue.trim()) {
      return setStatus("Add at least one image or a housing value.");
    }

    try {
      setStatus("Uploading...");
      setResult(null);
      setError("");

      const fd = new FormData();
      fd.append("idHex", idHex);
      fd.append("housingValue", housingValue.trim());
      for (const f of files.slice(0, 3)) fd.append("images", f);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
      setStatus("Saved.");
      // refresh IDs in case this was a brand-new ID object
      loadIds();
    } catch (e) {
      console.error(e);
      setStatus("");
      setError(e.message || "Upload failed");
    }
  };

  return (
    <main style={{ maxWidth: 880, margin: "40px auto", padding: 24, fontFamily: "system-ui" }}>
      <h1>Upload Images & Housing Value</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Select a property ID from <code>data/id.json</code>, upload up to <strong>3 images</strong>,
        and/or enter a housing value. Images will be saved under <code>/img/&lt;ID&gt;/filename</code>,
        and the paths + value will be recorded in <code>data/id.json</code>.
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
          Save
        </button>
      </form>

      {status && (
        <p style={{ marginTop: 12 }}>
          <strong>Status:</strong> {status}
        </p>
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
        </div>
      )}
    </main>
  );
}