"use client";
/**
 * Canton wallets (Console, Loop, any CIP-0103 extension or Wallet Gateway) via the official
 * @canton-network/dapp-sdk, loaded on demand. farmOS only connects to read the primary party id,
 * then disconnects. It never calls prepareExecute or signMessage.
 */
export async function connectCanton(): Promise<string> {
  const sdk = await import("@canton-network/dapp-sdk");
  await sdk.init();
  await sdk.connect();
  try {
    const accounts = await sdk.listAccounts();
    const acc = accounts.find((a) => a.primary) ?? accounts[0];
    if (!acc?.partyId) throw new Error("The wallet returned no party");
    return acc.partyId;
  } finally {
    await sdk.disconnect().catch(() => null);
  }
}
