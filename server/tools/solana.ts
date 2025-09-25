import {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  clusterApiUrl,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, Token } from '@solana/spl-token';
import { z } from 'zod';

// Types for Solana operations
type SolanaParameters = {
  operation:
    | 'balance'
    | 'send'
    | 'receive'
    | 'generate_wallet'
    | 'token_balance'
    | 'token_send'
    | 'token_info'
    | 'transaction_history'
    | 'transaction_status'
    | 'fee_estimation';
  network?: 'devnet' | 'testnet' | 'mainnet-beta';
  privateKey?: string;
  publicKey?: string;
  recipientAddress?: string;
  amount?: number;
  memo?: string;
  tokenMint?: string;
  tokenDecimals?: number;
  limit?: number;
  before?: string;
  signature?: string;
  transactionType?: 'sol_transfer' | 'token_transfer';
};

// Utility function to get connection based on network
function getConnection(network: string = 'devnet'): Connection {
  let endpoint: string;

  switch (network) {
    case 'mainnet-beta':
      endpoint = process.env.SOLANA_MAINNET_RPC || clusterApiUrl('mainnet-beta');
      break;
    case 'testnet':
      endpoint = process.env.SOLANA_TESTNET_RPC || clusterApiUrl('testnet');
      break;
    case 'devnet':
    default:
      endpoint = process.env.SOLANA_DEVNET_RPC || clusterApiUrl('devnet');
      break;
  }

  return new Connection(endpoint, 'confirmed');
}

// Generate a new Solana wallet
function generateWallet(): { publicKey: string; privateKey: string; mnemonic?: string } {
  const keypair = Keypair.generate();

  return {
    publicKey: keypair.publicKey.toString(),
    privateKey: Buffer.from(keypair.secretKey).toString('base64'),
  };
}

// Get wallet from private key
function getWalletFromPrivateKey(privateKeyBase64: string): Keypair {
  const privateKeyBuffer = Buffer.from(privateKeyBase64, 'base64');
  return Keypair.fromSecretKey(privateKeyBuffer);
}

// Get wallet balance (simple version for backward compatibility)
async function getBalance(publicKey: string, network: string = 'devnet'): Promise<number> {
  try {
    const connection = getConnection(network);
    const pubKey = new PublicKey(publicKey);
    const balance = await connection.getBalance(pubKey);
    return balance / LAMPORTS_PER_SOL; // Convert lamports to SOL
  } catch (error) {
    throw new Error(
      `Failed to get balance: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Get enhanced balance information
async function getEnhancedBalance(
  publicKey: string,
  network: string = 'devnet',
): Promise<{
  balance: number;
  balanceInLamports: number;
  rentExemptReserve: number;
  executable: boolean;
  owner: string;
  accountExists: boolean;
}> {
  try {
    const connection = getConnection(network);
    const pubKey = new PublicKey(publicKey);

    // Get balance in lamports
    const balanceInLamports = await connection.getBalance(pubKey);
    const balance = balanceInLamports / LAMPORTS_PER_SOL;

    // Get account info
    let accountInfo = null;
    let accountExists = true;
    try {
      accountInfo = await connection.getAccountInfo(pubKey);
      if (!accountInfo) {
        accountExists = false;
      }
    } catch {
      accountExists = false;
    }

    // Calculate rent-exempt reserve
    const rentExemptReserve =
      accountExists && accountInfo
        ? await connection.getMinimumBalanceForRentExemption(accountInfo.data.length)
        : await connection.getMinimumBalanceForRentExemption(0);

    return {
      balance,
      balanceInLamports,
      rentExemptReserve: rentExemptReserve / LAMPORTS_PER_SOL,
      executable: accountInfo?.executable || false,
      owner: accountInfo?.owner.toString() || '11111111111111111111111111111111', // System Program
      accountExists,
    };
  } catch (error) {
    throw new Error(
      `Failed to get enhanced balance: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Send SOL
async function sendSol(
  senderPrivateKey: string,
  recipientAddress: string,
  amount: number,
  network: string = 'devnet',
  memo?: string,
): Promise<{ signature: string; fee: number }> {
  try {
    const connection = getConnection(network);
    const senderKeypair = getWalletFromPrivateKey(senderPrivateKey);
    const recipientPubKey = new PublicKey(recipientAddress);

    // Create transaction
    const transaction = new Transaction();

    // Add transfer instruction
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: senderKeypair.publicKey,
      toPubkey: recipientPubKey,
      lamports: amount * LAMPORTS_PER_SOL, // Convert SOL to lamports
    });

    transaction.add(transferInstruction);

    // Add memo if provided
    if (memo) {
      const memoInstruction = {
        keys: [],
        programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
        data: Buffer.from(memo, 'utf8'),
      };
      transaction.add(memoInstruction);
    }

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = senderKeypair.publicKey;

    // Get estimated fee
    const fee = await connection.getFeeForMessage(transaction.compileMessage());
    const estimatedFee = fee?.value || 5000; // Default fallback

    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(connection, transaction, [senderKeypair], {
      commitment: 'confirmed',
    });

    return {
      signature,
      fee: estimatedFee / LAMPORTS_PER_SOL,
    };
  } catch (error) {
    throw new Error(
      `Failed to send SOL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Validate Solana address
function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

// Get SPL token balance
async function getTokenBalance(
  walletAddress: string,
  tokenMint: string,
  network: string = 'devnet',
): Promise<{ balance: number; decimals: number; uiAmount: number }> {
  try {
    const connection = getConnection(network);
    const walletPubKey = new PublicKey(walletAddress);
    const mintPubKey = new PublicKey(tokenMint);

    // Get the associated token account address
    const associatedTokenAddress = await Token.getAssociatedTokenAddress(
      TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mintPubKey,
      walletPubKey,
    );

    try {
      // Get the token account info
      const tokenAccount = await connection.getTokenAccountBalance(associatedTokenAddress);

      const balance = Number(tokenAccount.value.amount);
      const uiAmountFromAPI = tokenAccount.value.uiAmount || 0;
      const decimals = tokenAccount.value.decimals;

      return {
        balance,
        decimals,
        uiAmount: uiAmountFromAPI,
      };
    } catch {
      return { balance: 0, decimals: 0, uiAmount: 0 };
    }
  } catch (error) {
    throw new Error(
      `Failed to get token balance: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Get token information
async function getTokenInfo(
  tokenMint: string,
  network: string = 'devnet',
): Promise<{
  mintAuthority: string | null;
  supply: string;
  decimals: number;
  isInitialized: boolean;
  freezeAuthority: string | null;
}> {
  try {
    const connection = getConnection(network);
    const mintPubKey = new PublicKey(tokenMint);

    const mintInfo = await connection.getParsedAccountInfo(mintPubKey);
    if (!mintInfo.value) {
      throw new Error('Token mint not found');
    }

    const data = (
      mintInfo.value.data as {
        parsed?: {
          info?: {
            mintAuthority?: string | null;
            supply?: string;
            decimals?: number;
            isInitialized?: boolean;
            freezeAuthority?: string | null;
          };
        };
      }
    )?.parsed?.info;

    if (!data) {
      throw new Error('Invalid token mint data');
    }

    return {
      mintAuthority: data.mintAuthority || null,
      supply: data.supply || '0',
      decimals: data.decimals || 0,
      isInitialized: data.isInitialized || false,
      freezeAuthority: data.freezeAuthority || null,
    };
  } catch (error) {
    throw new Error(
      `Failed to get token info: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Send SPL tokens
async function sendTokens(
  senderPrivateKey: string,
  recipientAddress: string,
  tokenMint: string,
  amount: number,
  decimals: number,
  network: string = 'devnet',
): Promise<{ signature: string; fee: number }> {
  try {
    const connection = getConnection(network);
    const senderKeypair = getWalletFromPrivateKey(senderPrivateKey);
    const recipientPubKey = new PublicKey(recipientAddress);
    const mintPubKey = new PublicKey(tokenMint);

    // Get associated token addresses
    const senderTokenAddress = await Token.getAssociatedTokenAddress(
      TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mintPubKey,
      senderKeypair.publicKey,
    );

    const recipientTokenAddress = await Token.getAssociatedTokenAddress(
      TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mintPubKey,
      recipientPubKey,
    );

    const transaction = new Transaction();

    // Check if recipient token account exists, create if not
    try {
      await connection.getTokenAccountBalance(recipientTokenAddress);
    } catch {
      // Token account doesn't exist, create it
      transaction.add(
        Token.createAssociatedTokenAccountInstruction(
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          mintPubKey,
          recipientTokenAddress,
          recipientPubKey,
          senderKeypair.publicKey,
        ),
      );
    }

    // Add transfer instruction
    const transferAmount = amount * Math.pow(10, decimals);
    transaction.add(
      Token.createTransferInstruction(
        TOKEN_PROGRAM_ID,
        senderTokenAddress,
        recipientTokenAddress,
        senderKeypair.publicKey,
        [],
        transferAmount,
      ),
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = senderKeypair.publicKey;

    // Get estimated fee
    const fee = await connection.getFeeForMessage(transaction.compileMessage());
    const estimatedFee = fee?.value || 5000;

    // Send and confirm transaction
    const signature = await sendAndConfirmTransaction(connection, transaction, [senderKeypair], {
      commitment: 'confirmed',
    });

    return {
      signature,
      fee: estimatedFee / LAMPORTS_PER_SOL,
    };
  } catch (error) {
    throw new Error(
      `Failed to send tokens: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Get transaction history for a wallet
async function getTransactionHistory(
  walletAddress: string,
  network: string = 'devnet',
  limit: number = 10,
  before?: string,
): Promise<
  Array<{
    signature: string;
    slot?: number;
    blockTime?: number | null;
    confirmationStatus?: string;
    err?: string | null;
    fee?: number;
    preBalances?: number[];
    postBalances?: number[];
    logMessages?: string[];
    tokenTransfers?: Array<{
      mint: string;
      change: number;
      uiChange: number;
      decimals?: number;
    }>;
    solChange?: number;
    programs?: Array<{
      programId: string;
      instructionType: string;
    }>;
    error?: string;
  }>
> {
  try {
    const connection = getConnection(network);
    const walletPubKey = new PublicKey(walletAddress);

    const options: {
      limit: number;
      commitment: string;
      before?: string;
    } = {
      limit,
      commitment: 'confirmed',
    };

    if (before) {
      options.before = before;
    }

    // Get transaction signatures
    const signatures = await connection.getSignaturesForAddress(walletPubKey, options);

    if (signatures.length === 0) {
      return [];
    }

    // Get transaction details in batches to avoid rate limits
    const transactions = [];
    const batchSize = 5; // Process in smaller batches

    for (let i = 0; i < signatures.length; i += batchSize) {
      const batch = signatures.slice(i, i + batchSize);
      const batchPromises = batch.map(async (sig) => {
        try {
          const tx = await connection.getParsedTransaction(sig.signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          });

          if (!tx) return null;

          // Parse transaction details
          const result: {
            signature: string;
            slot?: number;
            blockTime?: number | null;
            confirmationStatus?: string;
            err?: string | null;
            fee?: number;
            preBalances?: number[];
            postBalances?: number[];
            logMessages?: string[];
            tokenTransfers?: Array<{
              mint: string;
              change: number;
              uiChange: number;
              decimals?: number;
            }>;
            solChange?: number;
            programs?: Array<{
              programId: string;
              instructionType: string;
            }>;
            error?: string;
          } = {
            signature: sig.signature,
            slot: sig.slot,
            blockTime: sig.blockTime,
            confirmationStatus: sig.confirmationStatus,
            err: sig.err ? JSON.stringify(sig.err) : null,
            fee: tx.meta?.fee || 0,
            preBalances: tx.meta?.preBalances || [],
            postBalances: tx.meta?.postBalances || [],
            logMessages: tx.meta?.logMessages || [],
          };

          // Extract transfer information
          if (tx.meta?.preTokenBalances && tx.meta?.postTokenBalances) {
            result.tokenTransfers = [];

            // Analyze token balance changes
            const preTokens = tx.meta.preTokenBalances;
            const postTokens = tx.meta.postTokenBalances;

            for (const postToken of postTokens) {
              const preToken = preTokens.find((pre) => pre.accountIndex === postToken.accountIndex);

              if (preToken) {
                const preAmount = Number(preToken.uiTokenAmount?.amount || 0);
                const postAmount = Number(postToken.uiTokenAmount?.amount || 0);
                const change = postAmount - preAmount;

                if (change !== 0) {
                  result.tokenTransfers.push({
                    mint: postToken.mint,
                    change,
                    uiChange: change / Math.pow(10, postToken.uiTokenAmount?.decimals || 0),
                    decimals: postToken.uiTokenAmount?.decimals,
                  });
                }
              }
            }
          }

          // Extract SOL transfer information
          if (tx.meta?.preBalances && tx.meta?.postBalances) {
            const accountIndex = tx.transaction.message.accountKeys.findIndex(
              (key) => key.pubkey.toString() === walletAddress,
            );

            if (accountIndex >= 0) {
              const preSol = tx.meta.preBalances[accountIndex] || 0;
              const postSol = tx.meta.postBalances[accountIndex] || 0;
              const solChange = (postSol - preSol) / LAMPORTS_PER_SOL;

              result.solChange = solChange;
            }
          }

          // Extract program information
          if (tx.transaction.message.instructions) {
            result.programs = tx.transaction.message.instructions.map(
              (ix: { programId?: { toString(): string }; parsed?: { type?: string } }) => {
                const programId = ix.programId?.toString() || '';
                return {
                  programId,
                  instructionType: ix.parsed?.type || 'unknown',
                };
              },
            );
          }

          return result;
        } catch (error) {
          console.error(`Error fetching transaction ${sig.signature}:`, error);
          return {
            signature: sig.signature,
            error: 'Failed to fetch transaction details',
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      transactions.push(...batchResults.filter((tx): tx is NonNullable<typeof tx> => tx !== null));

      // Small delay between batches to be nice to the RPC
      if (i + batchSize < signatures.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return transactions;
  } catch (error) {
    throw new Error(
      `Failed to get transaction history: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

// Check transaction status
async function getTransactionStatus(
  signature: string,
  network: string = 'devnet',
): Promise<{
  signature: string;
  confirmationStatus: string | null;
  confirmations: number | null;
  slot: number | null;
  blockTime: number | null;
  fee: number | null;
  success: boolean;
  error: string | null;
  explorerUrl: string;
}> {
  try {
    const connection = getConnection(network);

    // Get transaction with commitment levels
    const [confirmedTx, finalizedTx] = await Promise.allSettled([
      connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      }),
      connection.getTransaction(signature, {
        commitment: 'finalized',
        maxSupportedTransactionVersion: 0,
      }),
    ]);

    // Determine the transaction details from the best available source
    let transaction = null;
    let confirmationStatus = 'unknown';

    if (finalizedTx.status === 'fulfilled' && finalizedTx.value) {
      transaction = finalizedTx.value;
      confirmationStatus = 'finalized';
    } else if (confirmedTx.status === 'fulfilled' && confirmedTx.value) {
      transaction = confirmedTx.value;
      confirmationStatus = 'confirmed';
    }

    if (!transaction) {
      // Try to get signature status if transaction not found
      const signatureStatus = await connection.getSignatureStatus(signature);
      if (signatureStatus.value) {
        return {
          signature,
          confirmationStatus: signatureStatus.value.confirmationStatus || 'processed',
          confirmations: signatureStatus.value.confirmations,
          slot: signatureStatus.value.slot,
          blockTime: null,
          fee: null,
          success: !signatureStatus.value.err,
          error: signatureStatus.value.err ? JSON.stringify(signatureStatus.value.err) : null,
          explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=${network}`,
        };
      }

      throw new Error('Transaction not found');
    }

    return {
      signature,
      confirmationStatus,
      confirmations: null, // Not available in this context
      slot: transaction.slot || null,
      blockTime: transaction.blockTime ?? null,
      fee: transaction.meta?.fee !== undefined ? transaction.meta.fee / LAMPORTS_PER_SOL : null,
      success: !transaction.meta?.err,
      error: transaction.meta?.err ? JSON.stringify(transaction.meta.err) : null,
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=${network}`,
    };
  } catch (error) {
    throw new Error(
      `Failed to get transaction status: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Estimate transaction fees
async function estimateTransactionFee(
  senderAddress: string,
  transactionType: 'sol_transfer' | 'token_transfer',
  network: string = 'devnet',
  recipientAddress?: string,
  amount?: number,
  tokenMint?: string,
  memo?: string,
): Promise<{
  estimatedFee: number;
  estimatedFeeInLamports: number;
  transactionType: string;
  includesTokenAccountCreation: boolean;
  breakdown: {
    baseFee: number;
    accountCreationFee?: number;
    priorityFee: number;
  };
}> {
  try {
    const connection = getConnection(network);
    const senderPubKey = new PublicKey(senderAddress);

    const transaction = new Transaction();
    let includesTokenAccountCreation = false;
    let accountCreationFee = 0;

    if (transactionType === 'sol_transfer') {
      if (!recipientAddress || !amount) {
        throw new Error(
          'Recipient address and amount are required for SOL transfer fee estimation',
        );
      }

      const recipientPubKey = new PublicKey(recipientAddress);

      // Add transfer instruction
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: senderPubKey,
        toPubkey: recipientPubKey,
        lamports: amount * LAMPORTS_PER_SOL,
      });

      transaction.add(transferInstruction);

      // Add memo if provided
      if (memo) {
        // Note: This is a simplified memo - in practice you'd use the memo program
        const memoInstruction = {
          keys: [],
          programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
          data: Buffer.from(memo, 'utf8'),
        };
        transaction.add(memoInstruction);
      }
    } else if (transactionType === 'token_transfer') {
      if (!recipientAddress || !amount || !tokenMint) {
        throw new Error(
          'Recipient address, amount, and token mint are required for token transfer fee estimation',
        );
      }

      const recipientPubKey = new PublicKey(recipientAddress);
      const mintPubKey = new PublicKey(tokenMint);

      // Get token info to determine decimals
      const tokenInfo = await getTokenInfo(tokenMint, network);
      const decimals = tokenInfo.decimals;

      // Get associated token addresses
      const senderTokenAddress = await Token.getAssociatedTokenAddress(
        TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        mintPubKey,
        senderPubKey,
      );
      const recipientTokenAddress = await Token.getAssociatedTokenAddress(
        TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        mintPubKey,
        recipientPubKey,
      );

      // Check if recipient token account exists
      try {
        await connection.getTokenAccountBalance(recipientTokenAddress);
      } catch {
        // Token account doesn't exist, create it
        transaction.add(
          Token.createAssociatedTokenAccountInstruction(
            TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            mintPubKey,
            recipientTokenAddress,
            recipientPubKey,
            senderPubKey,
          ),
        );
        includesTokenAccountCreation = true;
        accountCreationFee = await connection.getMinimumBalanceForRentExemption(165); // Token account size
      }

      // Add transfer instruction
      const transferAmount = amount * Math.pow(10, decimals);
      transaction.add(
        Token.createTransferInstruction(
          TOKEN_PROGRAM_ID,
          senderTokenAddress,
          recipientTokenAddress,
          senderPubKey,
          [],
          transferAmount,
        ),
      );
    } else {
      throw new Error(`Unsupported transaction type: ${transactionType}`);
    }

    // Get recent blockhash for fee calculation
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = senderPubKey;

    // Get estimated fee
    const fee = await connection.getFeeForMessage(transaction.compileMessage());
    const baseFeeInLamports = fee?.value || 5000; // Default fallback

    const totalFeeInLamports = baseFeeInLamports + accountCreationFee;
    const totalFeeInSol = totalFeeInLamports / LAMPORTS_PER_SOL;

    return {
      estimatedFee: totalFeeInSol,
      estimatedFeeInLamports: totalFeeInLamports,
      transactionType,
      includesTokenAccountCreation,
      breakdown: {
        baseFee: baseFeeInLamports / LAMPORTS_PER_SOL,
        accountCreationFee:
          accountCreationFee > 0 ? accountCreationFee / LAMPORTS_PER_SOL : undefined,
        priorityFee: 0, // Could be extended to include priority fees
      },
    };
  } catch (error) {
    throw new Error(
      `Failed to estimate transaction fee: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

// Get default network from environment or fallback
function getDefaultNetwork(): string {
  return process.env.SOLANA_DEFAULT_NETWORK || 'devnet';
}

// Get default private key from environment
function getDefaultPrivateKey(): string | undefined {
  return process.env.SOLANA_WALLET_PRIVATE_KEY;
}

// Resolve private key (from parameter or environment)
function resolvePrivateKey(providedKey?: string): string {
  const privateKey = providedKey || getDefaultPrivateKey();
  if (!privateKey) {
    throw new Error(
      'Private key is required. Provide it as a parameter or set SOLANA_WALLET_PRIVATE_KEY environment variable.',
    );
  }
  return privateKey;
}

// Validate that public key matches private key
function validateKeyPair(privateKey: string, publicKey?: string): void {
  if (!publicKey) return; // No validation needed if no public key provided

  try {
    const keypair = getWalletFromPrivateKey(privateKey);
    const derivedPublicKey = keypair.publicKey.toString();

    if (derivedPublicKey !== publicKey) {
      throw new Error(
        'Security Error: Provided public key does not match the private key. This could be a malicious attempt.',
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Security Error')) {
      throw error; // Re-throw security errors
    }
    throw new Error('Invalid private key format');
  }
}

const solana = {
  id: 'solana',
  name: 'Solana Wallet',
  description:
    'Send and receive SOL and SPL tokens on the Solana blockchain. Supports wallet generation, balance checking, token operations, and transactions. Includes security validations to prevent malicious usage and fake address attacks.',
  inputSchema: z.object({
    operation: z
      .enum([
        'balance',
        'send',
        'receive',
        'generate_wallet',
        'token_balance',
        'token_send',
        'token_info',
        'transaction_history',
        'transaction_status',
        'fee_estimation',
      ])
      .describe(
        'Operation to perform: balance (check SOL balance), send (send SOL), receive (get wallet address), generate_wallet (create new wallet), token_balance (check SPL token balance), token_send (send SPL tokens), token_info (get token information), transaction_history (get transaction history), transaction_status (check transaction status), fee_estimation (estimate transaction fees)',
      ),
    network: z
      .enum(['devnet', 'testnet', 'mainnet-beta'])
      .optional()
      .describe('Solana network to use (defaults to SOLANA_DEFAULT_NETWORK env var or devnet)'),
    publicKey: z
      .string()
      .optional()
      .describe(
        'Public key of the wallet to use (optional if SOLANA_WALLET_PUBLIC_KEY is set in environment)',
      ),
    privateKey: z
      .string()
      .optional()
      .describe(
        'Base64 encoded private key (optional if SOLANA_WALLET_PRIVATE_KEY is set in environment)',
      ),
    recipientAddress: z
      .string()
      .optional()
      .describe('Recipient wallet address (required for send and token_send operations)'),
    amount: z
      .number()
      .positive()
      .optional()
      .describe('Amount of SOL or tokens to send (required for send and token_send operations)'),
    memo: z.string().optional().describe('Optional memo to include with the transaction'),
    tokenMint: z
      .string()
      .optional()
      .describe(
        'SPL token mint address (required for token_balance, token_send, and token_info operations)',
      ),
    tokenDecimals: z
      .number()
      .min(0)
      .max(18)
      .optional()
      .describe('Token decimals (optional, will be fetched from mint if not provided)'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .describe('Number of transactions to retrieve (max 100, default 10)'),
    before: z
      .string()
      .optional()
      .describe('Get transactions before this signature (for pagination)'),
    signature: z
      .string()
      .optional()
      .describe(
        'Transaction signature to check status (required for transaction_status operation)',
      ),
    transactionType: z
      .enum(['sol_transfer', 'token_transfer'])
      .optional()
      .describe('Type of transaction to estimate fees for (required for fee_estimation operation)'),
  }),
  execute: async ({
    operation,
    network,
    privateKey,
    publicKey,
    recipientAddress,
    amount,
    memo,
    tokenMint,
    tokenDecimals,
    limit,
    before,
    signature,
    transactionType,
  }: SolanaParameters) => {
    // Resolve network and private key defaults
    const resolvedNetwork = network || getDefaultNetwork();
    console.log(`[SOLANA] Executing operation: ${operation} on ${resolvedNetwork}`);

    try {
      switch (operation) {
        case 'generate_wallet': {
          const wallet = generateWallet();
          return JSON.stringify({
            success: true,
            operation: 'generate_wallet',
            wallet: {
              publicKey: wallet.publicKey,
              privateKey: wallet.privateKey,
            },
            network: resolvedNetwork,
            message: 'New wallet generated successfully. Store the private key securely!',
            warning:
              'NEVER share your private key. Anyone with access to it can control your wallet.',
          });
        }

        case 'balance': {
          const resolvedPrivateKey = resolvePrivateKey(privateKey);
          validateKeyPair(resolvedPrivateKey, publicKey);
          const wallet = getWalletFromPrivateKey(resolvedPrivateKey);
          const walletAddress = publicKey || wallet.publicKey.toString();
          const enhancedBalance = await getEnhancedBalance(walletAddress, resolvedNetwork);
          const spendableBalance = Math.max(
            0,
            enhancedBalance.balance - enhancedBalance.rentExemptReserve,
          );

          return JSON.stringify({
            success: true,
            operation: 'balance',
            publicKey: walletAddress,
            balance: enhancedBalance.balance,
            balanceInLamports: enhancedBalance.balanceInLamports,
            rentExemptReserve: enhancedBalance.rentExemptReserve,
            spendableBalance: spendableBalance,
            executable: enhancedBalance.executable,
            owner: enhancedBalance.owner,
            accountExists: enhancedBalance.accountExists,
            network: resolvedNetwork,
            message: `Wallet balance: ${enhancedBalance.balance} SOL (${spendableBalance.toFixed(
              6,
            )} spendable)`,
          });
        }

        case 'receive': {
          const resolvedPrivateKey = resolvePrivateKey(privateKey);
          validateKeyPair(resolvedPrivateKey, publicKey);
          const wallet = getWalletFromPrivateKey(resolvedPrivateKey);
          const walletAddress = publicKey || wallet.publicKey.toString();
          const balance = await getBalance(walletAddress, resolvedNetwork);

          return JSON.stringify({
            success: true,
            operation: 'receive',
            walletAddress: walletAddress,
            currentBalance: balance,
            network: resolvedNetwork,
            message: `Send SOL to this address: ${walletAddress}`,
            qrCode: `solana:${walletAddress}`,
          });
        }

        case 'send': {
          const resolvedPrivateKey = resolvePrivateKey(privateKey);
          validateKeyPair(resolvedPrivateKey, publicKey);

          if (!recipientAddress) {
            throw new Error('Recipient address is required for send operation');
          }
          if (!amount || amount <= 0) {
            throw new Error('Valid amount is required for send operation');
          }

          // Validate recipient address
          if (!isValidSolanaAddress(recipientAddress)) {
            throw new Error('Invalid recipient address format');
          }

          // Additional security: Prevent sending to self (common mistake/test pattern)
          const senderWallet = getWalletFromPrivateKey(resolvedPrivateKey);
          const senderAddress = publicKey || senderWallet.publicKey.toString();
          if (recipientAddress === senderAddress) {
            throw new Error('Security Warning: Cannot send SOL to the same wallet address');
          }

          // Check sender balance first
          const senderBalance = await getBalance(senderAddress, resolvedNetwork);

          if (senderBalance < amount) {
            throw new Error(
              `Insufficient balance. Current: ${senderBalance} SOL, Required: ${amount} SOL`,
            );
          }

          // Send the transaction
          const result = await sendSol(
            resolvedPrivateKey,
            recipientAddress,
            amount,
            resolvedNetwork,
            memo,
          );

          return JSON.stringify({
            success: true,
            operation: 'send',
            from: senderAddress,
            to: recipientAddress,
            amount,
            signature: result.signature,
            fee: result.fee,
            network: resolvedNetwork,
            memo: memo || null,
            message: `Successfully sent ${amount} SOL to ${recipientAddress}`,
            explorerUrl: `https://explorer.solana.com/tx/${result.signature}?cluster=${resolvedNetwork}`,
          });
        }

        case 'token_balance': {
          if (!tokenMint) {
            throw new Error('Token mint address is required for token_balance operation');
          }

          const resolvedPrivateKey = resolvePrivateKey(privateKey);
          validateKeyPair(resolvedPrivateKey, publicKey);
          const wallet = getWalletFromPrivateKey(resolvedPrivateKey);
          const walletAddress = publicKey || wallet.publicKey.toString();

          const tokenBalance = await getTokenBalance(walletAddress, tokenMint, resolvedNetwork);

          return JSON.stringify({
            success: true,
            operation: 'token_balance',
            publicKey: walletAddress,
            tokenMint,
            balance: tokenBalance.balance,
            uiAmount: tokenBalance.uiAmount,
            decimals: tokenBalance.decimals,
            network: resolvedNetwork,
            message: `Token balance: ${tokenBalance.uiAmount} tokens`,
          });
        }

        case 'token_info': {
          if (!tokenMint) {
            throw new Error('Token mint address is required for token_info operation');
          }

          const tokenInfo = await getTokenInfo(tokenMint, resolvedNetwork);

          return JSON.stringify({
            success: true,
            operation: 'token_info',
            tokenMint,
            tokenInfo,
            network: resolvedNetwork,
            message: `Token info retrieved for ${tokenMint}`,
          });
        }

        case 'token_send': {
          const resolvedPrivateKey = resolvePrivateKey(privateKey);
          validateKeyPair(resolvedPrivateKey, publicKey);

          if (!tokenMint) {
            throw new Error('Token mint address is required for token_send operation');
          }
          if (!recipientAddress) {
            throw new Error('Recipient address is required for token_send operation');
          }
          if (!amount || amount <= 0) {
            throw new Error('Valid amount is required for token_send operation');
          }

          // Validate recipient address
          if (!isValidSolanaAddress(recipientAddress)) {
            throw new Error('Invalid recipient address format');
          }

          // Get token info to determine decimals if not provided
          let resolvedDecimals: number;
          if (tokenDecimals !== undefined) {
            resolvedDecimals = tokenDecimals;
          } else {
            const tokenInfo = await getTokenInfo(tokenMint, resolvedNetwork);
            resolvedDecimals = tokenInfo.decimals;
          }

          // Additional security: Prevent sending to self
          const senderWallet = getWalletFromPrivateKey(resolvedPrivateKey);
          const senderAddress = publicKey || senderWallet.publicKey.toString();
          if (recipientAddress === senderAddress) {
            throw new Error('Security Warning: Cannot send tokens to the same wallet address');
          }

          // Check sender token balance first
          const senderTokenBalance = await getTokenBalance(
            senderAddress,
            tokenMint,
            resolvedNetwork,
          );
          if (senderTokenBalance.uiAmount < amount) {
            throw new Error(
              `Insufficient token balance. Current: ${senderTokenBalance.uiAmount} tokens, Required: ${amount} tokens`,
            );
          }

          // Send the tokens
          const result = await sendTokens(
            resolvedPrivateKey,
            recipientAddress,
            tokenMint,
            amount,
            resolvedDecimals,
            resolvedNetwork,
          );

          return JSON.stringify({
            success: true,
            operation: 'token_send',
            from: senderAddress,
            to: recipientAddress,
            tokenMint,
            amount,
            decimals: resolvedDecimals,
            signature: result.signature,
            fee: result.fee,
            network: resolvedNetwork,
            message: `Successfully sent ${amount} tokens to ${recipientAddress}`,
            explorerUrl: `https://explorer.solana.com/tx/${result.signature}?cluster=${resolvedNetwork}`,
          });
        }

        case 'transaction_history': {
          const resolvedPrivateKey = resolvePrivateKey(privateKey);
          validateKeyPair(resolvedPrivateKey, publicKey);
          const wallet = getWalletFromPrivateKey(resolvedPrivateKey);
          const walletAddress = publicKey || wallet.publicKey.toString();

          const historyLimit = limit || 10;
          const transactions = await getTransactionHistory(
            walletAddress,
            resolvedNetwork,
            historyLimit,
            before,
          );

          return JSON.stringify({
            success: true,
            operation: 'transaction_history',
            publicKey: walletAddress,
            network: resolvedNetwork,
            transactions,
            count: transactions.length,
            limit: historyLimit,
            message: `Retrieved ${transactions.length} transactions`,
          });
        }

        case 'transaction_status': {
          if (!signature) {
            throw new Error('Transaction signature is required for transaction_status operation');
          }

          const status = await getTransactionStatus(signature, resolvedNetwork);

          return JSON.stringify({
            success: true,
            operation: 'transaction_status',
            signature: status.signature,
            confirmationStatus: status.confirmationStatus,
            confirmations: status.confirmations,
            slot: status.slot,
            blockTime: status.blockTime,
            fee: status.fee,
            transactionSuccess: status.success,
            error: status.error,
            explorerUrl: status.explorerUrl,
            network: resolvedNetwork,
            message: `Transaction ${status.success ? 'succeeded' : 'failed'} with ${
              status.confirmationStatus
            } confirmation`,
          });
        }

        case 'fee_estimation': {
          if (!transactionType) {
            throw new Error('Transaction type is required for fee_estimation operation');
          }

          const resolvedPrivateKey = resolvePrivateKey(privateKey);
          validateKeyPair(resolvedPrivateKey, publicKey);
          const wallet = getWalletFromPrivateKey(resolvedPrivateKey);
          const walletAddress = publicKey || wallet.publicKey.toString();

          const feeEstimation = await estimateTransactionFee(
            walletAddress,
            transactionType,
            resolvedNetwork,
            recipientAddress,
            amount,
            tokenMint,
            memo,
          );

          return JSON.stringify({
            success: true,
            operation: 'fee_estimation',
            senderAddress: walletAddress,
            transactionType: feeEstimation.transactionType,
            estimatedFee: feeEstimation.estimatedFee,
            estimatedFeeInLamports: feeEstimation.estimatedFeeInLamports,
            includesTokenAccountCreation: feeEstimation.includesTokenAccountCreation,
            breakdown: feeEstimation.breakdown,
            network: resolvedNetwork,
            message: `Estimated fee: ${feeEstimation.estimatedFee.toFixed(6)} SOL${
              feeEstimation.includesTokenAccountCreation ? ' (includes token account creation)' : ''
            }`,
          });
        }

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      console.error('[SOLANA] Error executing operation:', error);
      return JSON.stringify({
        success: false,
        operation,
        network: resolvedNetwork,
        error: error instanceof Error ? error.message : String(error),
        message: 'Operation failed. Please check the error details.',
      });
    }
  },
};

export { solana };
