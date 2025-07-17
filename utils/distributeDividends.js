import { ethers } from "ethers";
import abi from "../constants/abi1.json";

export async function distributeDividends(fractionTokenAddress, ethAmount) {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(fractionTokenAddress, abi, signer);
  const tx = await contract.distributeDividends({ value: ethers.parseEther(ethAmount) });
  return tx.wait();
}