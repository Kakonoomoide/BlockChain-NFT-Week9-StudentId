const { ethers } = require("ethers");
const fs = require("node:fs");
const path = require("node:path");

// ===== Parameter contract =====
const NAME = "Tiket Praktikum";
const SYMBOL = "TKT";
const MAX_SUPPLY = 100;

async function main() {
  const rpcUrl = process.env.CMU_RPC_URL;
  const chainId = Number(process.env.CMU_CHAIN_ID);
  const privateKey = process.env.PRIVATE_KEY;
  if (!rpcUrl || !chainId || !privateKey) {
    throw new Error(
      "CMU_RPC_URL / CMU_CHAIN_ID / PRIVATE_KEY tidak ada. Jalankan lewat `cmu deploy`.",
    );
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl, chainId, {
    cacheTimeout: -1,
    staticNetwork: true,
  });
  const wallet = new ethers.Wallet(privateKey, provider);

  const artifact = JSON.parse(
    fs.readFileSync(path.resolve("artifacts", "TicketNFT.json"), "utf8"),
  );
  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.evm.bytecode.object,
    wallet,
  );

  console.log("Network   :", rpcUrl, `(chain ${chainId})`);
  console.log("Panitia   :", wallet.address);
  console.log("Deploying TicketNFT...");

  const nft = await factory.deploy(NAME, SYMBOL, MAX_SUPPLY);
  await nft.waitForDeployment();

  console.log("TicketNFT deployed to:", await nft.getAddress());
  console.log("Salin alamat di atas ke CONTRACT_ADDRESS di scripts/seed.js");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
