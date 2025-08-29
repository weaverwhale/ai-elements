// Test script for Solana tool
import { solana } from '../server/tools/solana.js';

console.log('🧪 Testing Solana Tool on Devnet...\n');

async function testSolanaOperations() {
  try {
    // Test 1: Check balance
    console.log('1️⃣  Testing balance check...');
    const balanceResult = await solana.execute({
      operation: 'balance',
      network: 'devnet',
    });
    console.log('Balance Result:', JSON.parse(balanceResult));
    console.log('');

    // Test 2: Get receiving address
    console.log('2️⃣  Testing receive operation...');
    const receiveResult = await solana.execute({
      operation: 'receive',
      network: 'devnet',
    });
    console.log('Receive Result:', JSON.parse(receiveResult));
    console.log('');

    // Test 3: Generate new wallet
    console.log('3️⃣  Testing wallet generation...');
    const walletResult = await solana.execute({
      operation: 'generate_wallet',
      network: 'devnet',
    });
    console.log('Wallet Result:', JSON.parse(walletResult));
    console.log('');

    console.log('✅ All tests completed!');
    console.log('💡 To test sending, fund your wallet first and then use the send operation.');
  } catch (error) {
    console.error('❌ Error testing Solana tool:', error);
  }
}

testSolanaOperations();
