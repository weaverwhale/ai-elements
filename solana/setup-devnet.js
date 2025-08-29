#!/usr/bin/env node

// Quick setup script for Solana devnet
import { Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

console.log('🚀 Setting up Solana Devnet...\n');

// Generate a new test wallet
const keypair = Keypair.generate();
const publicKey = keypair.publicKey.toString();
const privateKey = Buffer.from(keypair.secretKey).toString('base64');

console.log('✅ Generated new test wallet:');
console.log(`Public Key:  ${publicKey}`);
console.log(`Private Key: ${privateKey}\n`);

// Create .env file
const envPath = path.join(process.cwd(), '.env');
const envContent = `# Solana Devnet Configuration
SOLANA_WALLET_PRIVATE_KEY=${privateKey}
SOLANA_DEFAULT_NETWORK=devnet

# Other API Keys (add your existing keys here)
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
CEREBRAS_API_KEY=your_cerebras_api_key_here
GOOGLE_GENERATIVE_AI_API_KEY=your_google_genai_api_key_here
GITHUB_TOKEN=your_github_token_here

# Server Configuration
PORT=1753
NODE_ENV=development
`;

if (fs.existsSync(envPath)) {
  console.log('⚠️  .env file already exists. Creating .env.devnet instead...');
  fs.writeFileSync(path.join(process.cwd(), '.env.devnet'), envContent);
  console.log('📄 Created .env.devnet file with your wallet configuration');
  console.log('💡 Copy the Solana variables to your existing .env file');
} else {
  fs.writeFileSync(envPath, envContent);
  console.log('📄 Created .env file with your wallet configuration');
}

console.log('\n🎯 Next steps:');
console.log('1. Fund your wallet with devnet SOL:');
console.log(`   Visit: https://faucet.solana.com/`);
console.log(`   Address: ${publicKey}`);
console.log('\n2. Test your setup by running your server and trying the Solana tool');
console.log('\n⚠️  IMPORTANT: This is a TEST wallet for devnet only!');
console.log('   Never use this private key on mainnet with real funds.');
