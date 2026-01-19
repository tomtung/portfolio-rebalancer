export const INITIAL_CSV_DATA = `Account Name,Symbol,Current value
Main Brokerage,VTI,$120000.00
Main Brokerage,VXUS,$60000.00
Main Brokerage,BND,$20000.00
Roth IRA,AVUV,$15000.00
Roth IRA,AVDV,$10000.00
Play Money,AAPL,$5000.00
Play Money,GLD,$5000.00
Play Money,USD,$500.00`;

export const INITIAL_METADATA_JSON = JSON.stringify({
  "VTI": { 
    "assetClass": { "US Equities / Large Cap": 0.80, "US Equities / Mid Cap": 0.15, "US Equities / Small Cap": 0.05 },
    "description": "Vanguard Total Stock Market ETF"
  },
  "VXUS": { 
    "assetClass": { "Intl Equities / Developed": 0.75, "Intl Equities / Emerging": 0.25 },
    "description": "Vanguard Total Intl Stock ETF"
  },
  "BND": { "assetClass": "Fixed Income / US Bond", "description": "Vanguard Total Bond Market ETF" },
  "AVUV": { "assetClass": "US Equities / Small Cap", "description": "Avantis US Small Cap Value ETF" },
  "AVDV": { "assetClass": "Intl Equities / Small Cap", "description": "Avantis Intl Small Cap Value ETF" },
  "AAPL": { "assetClass": "US Equities / Large Cap", "description": "Apple Inc." },
  "GLD": { "assetClass": "Commodities", "description": "SPDR Gold Trust" },
  "USD": { "assetClass": "Cash", "description": "US Dollar" }
}, null, 2);
