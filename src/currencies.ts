// Currencies offered when opening accounts and placing holds
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'JPY']

// The backend refuses transfers in a currency without a transfer limit; only these have one (migration V5)
export const TRANSFER_CURRENCIES = ['USD', 'EUR']

// Taken out of every deposit and transfer, rounded down: 2%
export const FEE_PERCENT = 2
