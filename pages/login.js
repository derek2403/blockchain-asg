import { useState } from 'react';
import { useAccount } from 'wagmi';

export default function Login() {
  const { address, isConnected } = useAccount();
  const [imagePreview, setImagePreview] = useState(null);
  const [mimeType, setMimeType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');

  function handleFileChange(event) {
    setError('');
    setResult(null);
    setSaveMessage('');

    const file = event.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'].includes(file.type)) {
      setError('Unsupported file type. Please use JPEG, PNG, or PDF.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result);
      setMimeType(file.type);
    };
    reader.readAsDataURL(file);
  }

  async function handleParse() {
    if (!imagePreview || !mimeType) {
      setError('Please select or capture an image first.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    setSaveMessage('');

    try {
      const resp = await fetch('/api/parse-ic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: imagePreview, mimeType }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.message || 'Failed to parse IC');
      }
      setResult(data.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!isConnected || !address) {
      setError('Please connect your wallet first.');
      return;
    }
    if (!result?.icNumber) {
      setError('IC number not found. Please parse again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const resp = await fetch('/api/save-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, icNumber: result.icNumber }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.message || 'Failed to save user');
      }
      setSaveMessage('Saved successfully.');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Login / Sign up</h1>

      <div className="space-y-3">
        <label className="block text-sm font-medium">Scan or upload your IC</label>
        <input
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          onChange={handleFileChange}
          className="block w-full text-sm"
        />
        {imagePreview && mimeType?.startsWith('image/') && (
          <img src={imagePreview} alt="Preview" className="mt-2 max-h-64 rounded border" />
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleParse}
          disabled={loading || !imagePreview}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          {loading ? 'Processing…' : 'Parse IC'}
        </button>
        <button
          onClick={handleSave}
          disabled={loading || !result || !isConnected}
          className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50"
        >
          Save
        </button>
      </div>

      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}
      {saveMessage && (
        <div className="text-green-700 text-sm">{saveMessage}</div>
      )}

      {result && (
        <div className="mt-4 border rounded p-3 bg-gray-50 text-sm space-y-1">
          <div><span className="font-medium">IC Number:</span> {result.icNumber || ''}</div>
          <div><span className="font-medium">Full Name:</span> {result.fullName || ''}</div>
          <div><span className="font-medium">Address:</span> {result.address || ''}</div>
          <div><span className="font-medium">Post Code:</span> {result.postCode || ''}</div>
          <div><span className="font-medium">City:</span> {result.city || ''}</div>
          <div><span className="font-medium">State:</span> {result.state || ''}</div>
          <div><span className="font-medium">Country:</span> {result.country || ''}</div>
          <div><span className="font-medium">Citizenship:</span> {result.citizenship || ''}</div>
          <div><span className="font-medium">Gender:</span> {result.gender || ''}</div>
        </div>
      )}

      <div className="text-xs text-gray-500">
        Wallet connected: {isConnected ? address : 'No'}
      </div>
    </div>
  );
} 