# Portfolio Rebalancer

A client-side React application designed to help you manage, simulate, and rebalance your investment portfolio across multiple accounts. 

Instead of manually calculating trades to hit your target asset allocations, this tool uses a built-in Linear Programming (LP) solver to determine the optimal trades automatically, while respecting account boundaries and custom trade locks.

## ✨ Features

- **Smart Rebalancing Engine**: Define target allocation ranges (e.g., 50-55% US Equities) and let the LP solver calculate exactly what to buy and sell to hit your targets.
- **Trade Locks**: Need to avoid selling a specific position due to taxes? Lock specific assets or entire accounts from being bought or sold during rebalancing.
- **Granular Asset Class Mapping**: Map symbols to simple asset classes (e.g., `BND` → `Fixed Income`) or split allocations (e.g., `VTI` → `80% Large Cap, 15% Mid Cap, 5% Small Cap`).
- **"What-If" Trade Simulator**: Manually simulate buying and selling assets in your accounts. See how a trade affects your overall portfolio allocation before executing it in real life.
- **Visual Breakdown**: Interactive pie charts showing your current portfolio allocation versus your targets.
- **CSV Data Management**: Easily import and edit your portfolio data via a built-in visual CSV editor.
- **Local Privacy**: All data, metadata, adjustments, and settings are saved securely in your browser's `localStorage`. No data is ever sent to a server.

## 🛠 Tech Stack

- **Framework**: [React 18](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Math/Optimization**: [javascript-lp-solver](https://github.com/JWally/jsLPSolver)
- **Testing**: [Vitest](https://vitest.dev/)

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/tomtung/portfolio-rebalancer.git
   cd portfolio-rebalancer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`.

## 🧪 Running Tests

The solver and underlying mathematical utilities are covered by unit tests via Vitest. To run the test suite:

```bash
npm run test
```

## 📂 Project Structure

- `/src/components` - React UI components (Tables, Modals, Charts)
- `/src/utils` - Core business logic, CSV parsing, formatting, and the LP solver logic
- `/src/hooks` - Custom React hooks for `localStorage` persistence
- `/src/data` - Initial placeholder data and metadata formats
