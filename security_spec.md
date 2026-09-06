# Security Specification & Test Definitions

## 1. Data Invariants
- **NFT Integrity**: An NFT record must have valid string IDs (<= 128 chars), a valid token ID, creator address, owner address, non-negative royalty percentage (<= 100), and non-empty name and image URIs.
- **Collection Ownership**: A collection cannot be created without a valid creatorAddress, contractAddress, name, symbol, and valid royalty percentage.
- **Transaction Immutability**: Once written, transaction records cannot be modified or deleted.
- **Royalty Ledger Immutability**: Royalty payout records cannot be altered or removed.
- **Bridge Teleportation Integrity**: Bridge records must enforce valid source/destination chains, valid sender/recipient addresses, and strictly positive step transitions.

## 2. Dirty Dozen Malicious Payloads (Rejected by Rule Blueprints)
1. *Ghost Field Injection*: Payload with unknown arbitrary property `__shadow_admin: true` in NFT creation.
2. *Royalty Overflow*: NFT creation with `royaltyPercentage: 15000` (must be <= 100).
3. *ID Poisoning*: Document ID containing invalid characters or exceeding 128 characters (e.g. `!@#$%^&*` or 2KB string).
4. *Price Manipulation*: Negative NFT price `price: -50`.
5. *Collection Symbol Flooding*: Collection symbol exceeding 32 characters or invalid format.
6. *Transaction History Tampering*: Attempting an `update` or `delete` on an existing `/transactions/{txId}` document.
7. *Royalty Ledger Tampering*: Attempting an `update` or `delete` on an existing `/royalties/{royaltyId}` document.
8. *Blanket Query Scraping*: Querying without appropriate bounds or violating collection schema.
9. *Bridge Status Forgery*: Setting bridge status to arbitrary unverified string `status: 'free_mint_exploit'`.
10. *Creator Impersonation*: Altering the original `creatorAddress` during an NFT transfer/update.
11. *Oversized String Attack (Denial of Wallet)*: NFT description containing > 2000 characters.
12. *Corrupted Media URIs*: Submitting image URLs > 2048 characters to exhaust memory buffers.

## 3. Test Runner
Verified against local and security rule validator to guarantee standard read/write safety for public Web3 studio operations and immutable ledgers.
