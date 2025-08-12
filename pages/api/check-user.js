import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ message: 'Missing required field: walletAddress' });
    }

    const filePath = path.resolve(process.cwd(), 'data/users.json');

    if (!fs.existsSync(filePath)) {
      return res.status(200).json({ 
        exists: false, 
        message: 'No users found' 
      });
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const users = JSON.parse(raw || '[]');
      
      if (!Array.isArray(users)) {
        return res.status(200).json({ 
          exists: false, 
          message: 'Invalid users data' 
        });
      }

      const normalizedAddress = String(walletAddress).toLowerCase();
      const user = users.find(u => (u.walletAddress || '').toLowerCase() === normalizedAddress);

      if (user) {
        return res.status(200).json({
          exists: true,
          user: {
            walletAddress: user.walletAddress,
            icNumber: user.icNumber
          },
          message: 'User found'
        });
      } else {
        return res.status(200).json({
          exists: false,
          message: 'User not found'
        });
      }

    } catch (parseError) {
      console.error('Error parsing users.json:', parseError);
      return res.status(200).json({ 
        exists: false, 
        message: 'Error reading user data' 
      });
    }

  } catch (error) {
    console.error('Error checking user:', error);
    return res.status(500).json({ 
      message: 'Failed to check user', 
      error: error.message 
    });
  }
} 