export const INITIAL_CSV_DATA = `Account Name,Symbol,Description,Current value,% of account,Quantity,Account type
Main Brokerage,VTI,VANGUARD TOTAL STOCK MARKET ETF,$120000.00,60.00%,500,Margin
Main Brokerage,VXUS,VANGUARD TOTAL INTL STOCK ETF,$60000.00,30.00%,1000,Margin
Main Brokerage,BND,VANGUARD TOTAL BOND MARKET ETF,$20000.00,10.00%,250,Cash
Roth IRA,AVUV,AVANTIS US SMALL CAP VALUE ETF,$15000.00,60.00%,180,Cash
Roth IRA,AVDV,AVANTIS INTL SMALL CAP VALUE ETF,$10000.00,40.00%,150,Cash
Play Money,AAPL,APPLE INC,$5000.00,50.00%,25,Cash
Play Money,GLD,SPDR GOLD TRUST,$5000.00,50.00%,25,Cash`;

export const INITIAL_METADATA_JSON = JSON.stringify({
  "VTI": { "US Equities / Large Cap": 0.80, "US Equities / Mid Cap": 0.15, "US Equities / Small Cap": 0.05 },
  "VXUS": { "Intl Equities / Developed": 0.75, "Intl Equities / Emerging": 0.25 },
  "BND": "Fixed Income / US Bond",
  "AVUV": "US Equities / Small Cap",
  "AVDV": "Intl Equities / Small Cap",
  "AAPL": "US Equities / Large Cap",
  "GLD": "Commodities",
  "WMU": "Alternatives / Private Equity"
}, null, 2);
