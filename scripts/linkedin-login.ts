/**
 * One-time LinkedIn login to capture a browser session for the OPT-IN automation.
 *
 * ⚠️  Automating LinkedIn violates its Terms of Service and risks account bans.
 *     Only run this if you understand and accept that risk.
 *
 * Usage:  npm run linkedin:login
 * Opens a real browser window — log in (and pass any 2FA) manually, then press
 * Enter in this terminal. Your session is saved to LINKEDIN_SESSION_PATH.
 *
 * NOTE: requires a desktop/headful environment. It will not work on a headless
 * server. Run it on your own machine.
 */
import readline from "node:readline";

const SESSION_PATH = process.env.LINKEDIN_SESSION_PATH || "./.linkedin-session.json";

async function main() {
  const { chromium } = await import("playwright");
  console.log("Launching browser… log in to LinkedIn in the window that opens.");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("https://www.linkedin.com/login");

  await new Promise<void>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("\nAfter you have logged in fully, press Enter here to save the session… ", () => {
      rl.close();
      resolve();
    });
  });

  await context.storageState({ path: SESSION_PATH });
  console.log(`\n✔ Session saved to ${SESSION_PATH}. You can close the browser.`);
  await browser.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
