import { ethers } from "ethers";
import abi from "../constants/abi.json";

const CONTRACT_ADDRESS = "0xA39d5e900d800FafB221FC1760885692ed050CDF";
const RPC_URL = "https://arb-sepolia.g.alchemy.com/v2/6U7t79S89NhHIspqDQ7oKGRWp5ZOfsNj";

export async function depositDividends(propertyId, ethAmount) {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
  const tx = await contract.depositDividends(propertyId, {
    value: ethers.parseEther(ethAmount)
  });
  return tx.wait();
}