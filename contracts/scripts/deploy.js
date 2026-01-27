const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("=".repeat(50));
  console.log("WorkProofToken (WPT) Deployment");
  console.log("=".repeat(50));
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "MATIC");
  console.log("");

  // Deploy upgradeable contract
  console.log("Deploying WorkProofToken...");
  const WorkProofToken = await ethers.getContractFactory("WorkProofToken");

  const token = await upgrades.deployProxy(WorkProofToken, [], {
    initializer: "initialize",
    kind: "uups"
  });

  await token.waitForDeployment();

  const proxyAddress = await token.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("");
  console.log("=".repeat(50));
  console.log("Deployment Complete!");
  console.log("=".repeat(50));
  console.log("Proxy Address:", proxyAddress);
  console.log("Implementation:", implementationAddress);
  console.log("");

  // Verify contract info
  const name = await token.name();
  const symbol = await token.symbol();
  const decimals = await token.decimals();
  const owner = await token.owner();
  const transfersEnabled = await token.transfersEnabled();

  console.log("Token Info:");
  console.log("  Name:", name);
  console.log("  Symbol:", symbol);
  console.log("  Decimals:", decimals.toString());
  console.log("  Owner:", owner);
  console.log("  Transfers Enabled:", transfersEnabled);
  console.log("");

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    proxyAddress: proxyAddress,
    implementationAddress: implementationAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    tokenInfo: {
      name,
      symbol,
      decimals: Number(decimals)
    }
  };

  fs.writeFileSync(
    `./deployments/${hre.network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log(`Deployment info saved to ./deployments/${hre.network.name}.json`);
  console.log("");
  console.log("Next steps:");
  console.log("1. Add WPT_CONTRACT_ADDRESS=" + proxyAddress + " to .env");
  console.log("2. Verify contract on Polygonscan:");
  console.log(`   npx hardhat verify --network ${hre.network.name} ${implementationAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
