/**
 * Registers the Patina app identity with the Vana Data Gateway.
 *
 * The gateway URL, chain id and verifying contract below come from the
 * registration snippet Vana Account generates for the selected network.
 * The private key is read from .env.local and never leaves this machine.
 *
 *   node scripts/register-app.mjs            # moksha (default)
 *   node scripts/register-app.mjs mainnet
 */
import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";

const NETWORKS = {
  moksha: {
    gatewayUrl: "https://dp-rpc.moksha.vana.org",
    chainId: 14800,
    verifyingContract: "0x8325C0A0948483EdA023A1A2Fd895e62C5131234",
  },
  mainnet: {
    // Filled in from Vana Account's mainnet snippet before we go live.
    gatewayUrl: "https://dp-rpc.vana.org",
    chainId: 1480,
    verifyingContract: null,
  },
};

const network = process.argv[2] ?? "moksha";
const config = NETWORKS[network];
if (!config) throw new Error(`Unknown network: ${network}`);
if (!config.verifyingContract) {
  throw new Error(
    `No verifying contract recorded for ${network}. Get it from the registration snippet at account.vana.org/developers with the network toggle set to ${network}.`,
  );
}

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    }),
);

const account = privateKeyToAccount(env.VANA_APP_PRIVATE_KEY);
const appUrl = env.VANA_APP_URL;

const message = {
  ownerAddress: account.address,
  granteeAddress: account.address,
  publicKey: account.publicKey,
  appUrl,
};

const signature = await account.signTypedData({
  domain: {
    name: "Vana Data Portability",
    version: "1",
    chainId: config.chainId,
    verifyingContract: config.verifyingContract,
  },
  types: {
    BuilderRegistration: [
      { name: "ownerAddress", type: "address" },
      { name: "granteeAddress", type: "address" },
      { name: "publicKey", type: "string" },
      { name: "appUrl", type: "string" },
    ],
  },
  primaryType: "BuilderRegistration",
  message,
});

const response = await fetch(`${config.gatewayUrl}/v1/builders`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Web3Signed ${signature}`,
  },
  body: JSON.stringify(message),
});

const body = await response.text();
if (!response.ok) {
  throw new Error(`Registration failed (${response.status}): ${body}`);
}

console.log(`network:     ${network}`);
console.log(`app address: ${account.address}`);
console.log(`app url:     ${appUrl}`);
console.log(`gateway said: ${body}`);
