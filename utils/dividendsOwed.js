import { ethers } from "ethers";
import abi from "../constants/abi1.json";

export async function dividendsOwed(fractionTokenAddress, userAddress) {
  const provider = new ethers.JsonRpcProvider("https://arb-sepolia.g.alchemy.com/v2/6U7t79S89NhHIspqDQ7oKGRWp5ZOfsNj");
  const contract = new ethers.Contract(fractionTokenAddress, abi, provider);
  return await contract.dividendsOwed(userAddress);
}