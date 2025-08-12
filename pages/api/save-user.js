import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { walletAddress, icNumber } = req.body;

    if (!walletAddress || !icNumber) {
      return res.status(400).json({ message: 'Missing required fields: walletAddress and icNumber' });
    }

    const filePath = path.resolve(process.cwd(), 'users.json');

    let users = [];
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        users = JSON.parse(raw || '[]');
        if (!Array.isArray(users)) users = [];
      } catch {
        users = [];
      }
    }

    const normalizedAddress = String(walletAddress).toLowerCase();

    const existingIndex = users.findIndex(u => (u.walletAddress || '').toLowerCase() === normalizedAddress);
    if (existingIndex >= 0) {
      users[existingIndex] = { ...users[existingIndex], walletAddress, icNumber };
    } else {
      users.push({ walletAddress, icNumber });
    }

    fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf8');

    return res.status(200).json({ success: true, message: 'User saved', data: { walletAddress, icNumber } });
  } catch (error) {
    console.error('Error saving user:', error);
    return res.status(500).json({ message: 'Failed to save user', error: error.message });
  }
} 