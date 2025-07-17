import { ethers } from "ethers";
import abi from "../constants/abi1.json";

export async function withdrawDividends(fractionTokenAddress) {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(fractionTokenAddress, abi, signer);
  const tx = await contract.withdrawDividends();
  return tx.wait();
}