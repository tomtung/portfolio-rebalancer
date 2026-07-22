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
    "assetClass": {
      "US Equities / Large Cap": 0.8,
      "US Equities / Mid Cap": 0.15,
      "US Equities / Small Cap": 0.05
    },
    "description": "Vanguard Total Stock Market ETF"
  },
  "VXUS": {
    "assetClass": {
      "Intl Equities / Developed Large Cap": 0.58,
      "Intl Equities / Developed Mid & Small Cap": 0.16,
      "Intl Equities / Emerging": 0.26
    },
    "description": "Vanguard Total Intl Stock ETF"
  },
  "BND": {
    "assetClass": "Fixed Income / US Bond",
    "description": "Vanguard Total Bond Market ETF"
  },
  "AVUV": {
    "assetClass": "US Equities / Small Cap",
    "description": "Avantis US Small Cap Value ETF"
  },
  "AVDV": {
    "assetClass": "Intl Equities / Developed Mid & Small Cap",
    "description": "Avantis Intl Small Cap Value ETF"
  },
  "USD": {
    "assetClass": "Cash",
    "description": "US Dollar"
  },
  "FDLXX": {
    "assetClass": "Cash",
    "description": "Fidelity Treasury Only Money Market Fund"
  },
  "SPAXX": {
    "assetClass": "Cash",
    "description": "Fidelity Government Money Market Fund"
  },
  "FDRXX": {
    "assetClass": "Cash",
    "description": "Fidelity Government Cash Reserves"
  },
  "FSMAX": {
    "assetClass": {
      "US Equities / Mid Cap": 0.2,
      "US Equities / Small Cap": 0.8
    },
    "description": "Fidelity Extended Market Index Fund"
  },
  "FTIHX": {
    "assetClass": {
      "Intl Equities / Developed Large Cap": 0.53,
      "Intl Equities / Developed Mid & Small Cap": 0.13,
      "Intl Equities / Emerging": 0.34
    },
    "description": "Fidelity Total International Index Fund"
  },
  "IEFA": {
    "assetClass": {
      "Intl Equities / Developed Large Cap": 0.8,
      "Intl Equities / Developed Mid & Small Cap": 0.2
    },
    "description": "iShares Core MSCI EAFE ETF"
  },
  "IEMG": {
    "assetClass": "Intl Equities / Emerging",
    "description": "iShares Core MSCI Emerging Markets ETF"
  },
  "ITOT": {
    "assetClass": {
      "US Equities / Large Cap": 0.7,
      "US Equities / Mid Cap": 0.2,
      "US Equities / Small Cap": 0.1
    },
    "description": "iShares Core S&P Total US Stock Market ETF"
  },
  "IWN": {
    "assetClass": "US Equities / Small Cap",
    "description": "iShares Russell 2000 Value ETF"
  },
  "IWS": {
    "assetClass": {
      "US Equities / Mid Cap": 0.7,
      "US Equities / Small Cap": 0.3
    },
    "description": "iShares Russell Mid-Cap Value ETF"
  },
  "SCHB": {
    "assetClass": {
      "US Equities / Large Cap": 0.7,
      "US Equities / Mid Cap": 0.2,
      "US Equities / Small Cap": 0.1
    },
    "description": "Schwab U.S. Broad Market ETF"
  },
  "SCHF": {
    "assetClass": {
      "Intl Equities / Developed Large Cap": 0.85,
      "Intl Equities / Developed Mid & Small Cap": 0.15
    },
    "description": "Schwab International Equity ETF"
  },
  "SCHV": {
    "assetClass": {
      "US Equities / Large Cap": 0.6,
      "US Equities / Mid Cap": 0.3,
      "US Equities / Small Cap": 0.1
    },
    "description": "Schwab U.S. Large-Cap Value ETF"
  },
  "SPDW": {
    "assetClass": {
      "Intl Equities / Developed Large Cap": 0.8,
      "Intl Equities / Developed Mid & Small Cap": 0.2
    },
    "description": "State Street SPDR Portfolio Developed World ex-US ETF"
  },
  "SPYM": {
    "assetClass": {
      "US Equities / Large Cap": 0.8,
      "US Equities / Mid Cap": 0.2
    },
    "description": "State Street SPDR Portfolio S&P 500 ETF"
  },
  "VBR": {
    "assetClass": {
      "US Equities / Mid Cap": 0.25,
      "US Equities / Small Cap": 0.75
    },
    "description": "Vanguard Small-Cap Value Index Fund ETF Shares"
  },
  "VEA": {
    "assetClass": {
      "Intl Equities / Developed Large Cap": 0.8,
      "Intl Equities / Developed Mid & Small Cap": 0.2
    },
    "description": "Vanguard FTSE Developed Markets Index Fund ETF Shares"
  },
  "VOE": {
    "assetClass": {
      "US Equities / Large Cap": 0.07,
      "US Equities / Mid Cap": 0.93
    },
    "description": "Vanguard Mid-Cap Value Index Fund ETF Shares"
  },
  "VT": {
    "assetClass": {
      "US Equities / Large Cap": 0.46,
      "US Equities / Mid Cap": 0.11,
      "US Equities / Small Cap": 0.04,
      "Intl Equities / Developed Large Cap": 0.23,
      "Intl Equities / Developed Mid & Small Cap": 0.06,
      "Intl Equities / Emerging": 0.1
    },
    "description": "Vanguard Total World Stock Index Fund ETF"
  },
  "VTV": {
    "assetClass": {
      "US Equities / Large Cap": 0.7,
      "US Equities / Mid Cap": 0.3
    },
    "description": "Vanguard Value Index Fund ETF"
  },
  "VWO": {
    "assetClass": "Intl Equities / Emerging",
    "description": "Vanguard FTSE Emerging Markets Index Fund ETF"
  },
  "WMU": {
    "assetClass": "Alternative / Private Equity",
    "description": "Waymo"
  },
  "EDGAR": {
    "assetClass": "Alternative / Hedge Fund",
    "description": "Jane Street"
  },
  "FNSOX": {
    "assetClass": "Fixed Income / US Bond",
    "description": "Fidelity Short-Term Bond Index Fund"
  },
  "FPADX": {
    "assetClass": "Intl Equities / Emerging",
    "description": "Fidelity Emerging Markets Index Fund"
  },
  "FSKAX": {
    "assetClass": {
      "US Equities / Large Cap": 0.7,
      "US Equities / Mid Cap": 0.2,
      "US Equities / Small Cap": 0.1
    },
    "description": "Fidelity Total Market Index Fund"
  },
  "FSMDX": {
    "assetClass": {
      "US Equities / Large Cap": 0.1,
      "US Equities / Mid Cap": 0.68,
      "US Equities / Small Cap": 0.22
    },
    "description": "Fidelity Mid Cap Index Fund"
  },
  "FSPSX": {
    "assetClass": {
      "Intl Equities / Developed Large Cap": 0.91,
      "Intl Equities / Developed Mid & Small Cap": 0.09
    },
    "description": "Fidelity International Index Fund"
  },
  "FSSNX": {
    "assetClass": {
      "US Equities / Mid Cap": 0.08,
      "US Equities / Small Cap": 0.92
    },
    "description": "Fidelity Small Cap Index Fund"
  },
  "FXAIX": {
    "assetClass": {
      "US Equities / Large Cap": 0.8,
      "US Equities / Mid Cap": 0.2
    },
    "description": "Fidelity 500 Index Fund"
  },
  "FXNAX": {
    "assetClass": "Fixed Income / US Bond",
    "description": "Fidelity US Bond Index Fund"
  },
  "VBAIX": {
    "assetClass": {
      "US Equities / Large Cap": 0.7,
      "US Equities / Mid Cap": 0.2,
      "US Equities / Small Cap": 0.1
    },
    "description": "Vanguard Balanced Index Fund Institutional"
  }
}, null, 2);
