# Stratax Frontend

React frontend for interacting with the Stratax leveraged position smart contract.

## Features

- Connect wallet (MetaMask)
- Create leveraged positions
- Unwind existing positions
- Calculate leverage parameters
- View position details
- **View Aave positions held by Stratax contracts via Aave GraphQL API**

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure the contract address in `src/config/contracts.js`

3. Start the development server:

```bash
npm start
```

4. Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

## Aave GraphQL Integration

The frontend uses the Aave GraphQL API to fetch and display Aave positions held by Stratax contracts. The integration provides:

- Real-time position data including collateral, debt, and health factors
- Support for multiple networks (Ethereum, Polygon, Arbitrum, Base, Optimism, Avalanche)
- Automatic position parsing and display
- Refresh functionality to update positions on-demand
- No API key required - uses public Aave subgraph endpoints

## Contract Interaction

The frontend interacts with the Stratax contract deployed on the blockchain. Make sure to:

- Have MetaMask installed and connected
- Be on the correct network
- Have sufficient tokens for gas fees
