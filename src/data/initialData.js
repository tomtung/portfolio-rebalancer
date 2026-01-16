export const INITIAL_CSV_DATA = `Account Name,Symbol,Current value,% of account,Quantity,Account type
Main Brokerage,VTI,$120000.00,60.00%,500,Margin
Main Brokerage,VXUS,$60000.00,30.00%,1000,Margin
Main Brokerage,BND,$20000.00,10.00%,250,Cash
Roth IRA,AVUV,$15000.00,60.00%,180,Cash
Roth IRA,AVDV,$10000.00,40.00%,150,Cash
Play Money,AAPL,$5000.00,50.00%,25,Cash
Play Money,GLD,$5000.00,50.00%,25,Cash
Play Money,USD,$500.00,5.00%,500,Cash`;

export const INITIAL_METADATA_JSON = JSON.stringify({
  "VTI": { 
    "category": { "US Equities / Large Cap": 0.80, "US Equities / Mid Cap": 0.15, "US Equities / Small Cap": 0.05 },
    "description": "Vanguard Total Stock Market ETF"
  },
  "VXUS": { 
    "category": { "Intl Equities / Developed": 0.75, "Intl Equities / Emerging": 0.25 },
    "description": "Vanguard Total Intl Stock ETF"
  },
  "BND": { "category": "Fixed Income / US Bond", "description": "Vanguard Total Bond Market ETF" },
  "AVUV": { "category": "US Equities / Small Cap", "description": "Avantis US Small Cap Value ETF" },
  "AVDV": { "category": "Intl Equities / Small Cap", "description": "Avantis Intl Small Cap Value ETF" },
  "AAPL": { "category": "US Equities / Large Cap", "description": "Apple Inc." },
  "GLD": { "category": "Commodities", "description": "SPDR Gold Trust" },
  "USD": { "category": "Cash", "description": "US Dollar" }
}, null, 2);
