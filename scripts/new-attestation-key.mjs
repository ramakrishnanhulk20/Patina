/**
 * Makes the key that signs Patina scores, and tells you what to do with it.
 *
 * WHY A SCRIPT RATHER THAN INSTRUCTIONS. Setting this up by hand is three
 * fiddly steps: generate 32 random bytes, work out the Ethereum address that
 * belongs to them, and keep the two together without mixing them up. Getting
 * the address wrong is the expensive mistake, because the site would then tell
 * every visitor that every genuine Patina score is a forgery, quietly, with no
 * error anywhere. So the machine does all three and prints the answer.
 *
 * WHAT THE KEY IS FOR. Signing a score is not a transaction and cannot move
 * money. This key holds no funds and never will. Its whole job is to be a
 * different secret from the one that DOES hold the escrow balance, so that a
 * leak of one is not a leak of both.
 *
 *   npm run key:attestation
 *
 * Nothing is written to disk and nothing is sent anywhere. The key exists only
 * in this terminal output, which is why the script tells you to close it.
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const privateKey = generatePrivateKey();
const { address } = privateKeyToAccount(privateKey);

const line = "─".repeat(72);

console.log(`
${line}
  PATINA SCORE SIGNING KEY
${line}

  Two values. They belong together and do different jobs.

  1. THE SECRET  (goes in your hosting settings, never in the repo)

     PATINA_ATTESTATION_KEY=${privateKey}

  2. THE PUBLIC ADDRESS  (goes in the code, safe to publish)

     ${address}

${line}
  WHAT TO DO, IN ORDER
${line}

  1. Copy the SECRET above into Vercel:
        Project  ->  Settings  ->  Environment Variables
        Name:    PATINA_ATTESTATION_KEY
        Value:   ${privateKey}
        Apply to Production (and Preview, if you use it)

  2. Put the PUBLIC ADDRESS into the code. Open
        src/lib/patina-address.ts
     and change PATINA_APP_ADDRESS to:
        "${address}"

  3. Commit and deploy that change.

  4. Check it worked. Open your admin page. The warning that says scores are
     signed with the same key as the money should be gone.

  5. Close this terminal window, so the secret is not left on screen or in
     your scroll history.

${line}
  BEFORE YOU DO THIS, KNOW ONE THING
${line}

  Changing the address changes what every score verifies against. Scores are
  signed fresh on every request, so nothing stored breaks. But any copy
  somebody already downloaded stops verifying, and they will see "not signed
  by Patina" rather than "out of date".

  Scores expire after thirty days, so that ends on its own within a month.
  If you have integrators, tell them the address is changing. If you do not
  have any yet, this is the cheapest moment this will ever be.

${line}
`);
