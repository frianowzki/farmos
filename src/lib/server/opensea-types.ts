/** Client-safe OpenSea drop types (no server imports). */
export type DropStage = {
  uuid: string;
  label: string | null;
  stage_type: string;
  price: string | null;
  price_currency_address: string;
  start_time: string;
  end_time: string;
  max_per_wallet: string;
  allowlist_wallet_count: number | null;
};
export type Drop = {
  collection_slug: string;
  collection_name: string | null;
  chain: string;
  contract_address: string;
  drop_type: string;
  image_url: string | null;
  is_minting: boolean;
  opensea_url: string;
  active_stage: DropStage | null;
  next_stage: DropStage | null;
};
export type DropDetail = Drop & { stages: DropStage[]; max_supply: string | null; total_supply: string | null; fee_bps?: number };

export type Verdict = "eligible" | "not_eligible" | "unknown";
export type StageCheck = { stage: string; type: string; verdict: Verdict; how: string };
export type WalletCheck = { address: string; label: string; verdict: Verdict; stages: StageCheck[] };
export type Eligibility = { checkedAt: string; chainSupported: boolean; merkle: { root: string | null; listUri: string | null; listSize: number | null; rootVerified: boolean | null; note?: string }; wallets: WalletCheck[] };

/** A drop with its detail + collection fields merged in, for the list view. */
export type DropRich = Drop & {
  kinds: ("upcoming" | "featured" | "recently_minted")[];
  max_supply: string | null;
  total_supply: string | null;
  stage_count: number;
  first_start: string | null;
  last_end: string | null;
  public_price: string | null;
  price_currency_address: string | null;
  description: string | null;
  banner_image_url: string | null;
  links: { x: string | null; site: string | null; discord: string | null; telegram: string | null };
  safelist: string | null;
};
