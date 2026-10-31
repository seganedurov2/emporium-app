import { TonClient, WalletContractV4, Address } from '@ton/ton';

interface TonConfig {
    apiKey: string;
    walletMnemonic: string[];
    botToken: string;
    adminChatId: string;
}

export class TonFinanceManager {
    private client: TonClient;
    private wallet?: WalletContractV4;
    private config: TonConfig;

    constructor(config: TonConfig) {
        this.config = config;
        this.client = new TonClient({
            endpoint: 'https://toncenter.com/api/v2/jsonRPC',
            apiKey: config.apiKey,
        });

        try {
            if (config.walletMnemonic && config.walletMnemonic.length > 0 && config.walletMnemonic[0] !== '') {
                const tonCrypto = require('@ton/crypto');
                const key = tonCrypto.mnemonicToWalletKey(config.walletMnemonic.filter(Boolean));
                if (key?.publicKey) {
                    this.wallet = WalletContractV4.create({ 
                        publicKey: key.publicKey, 
                        workchain: 0 
                    });
                }
            }
        } catch (e) {
            console.error('Wallet init error:', e);
        }
    }

    async sendCoins(toAddress: string, amount: number) {
        try {
            if (!this.wallet) throw new Error('Wallet not initialized');
            const destAddr = Address.parse(toAddress);
            const amountInNanotons = BigInt(Math.floor(amount * 1e9));

            await (this.wallet as any).transfer({
                seqno: await (this.wallet as any).getSeqno(this.client),
                secretKey: (this as any).secretKey,
                to: destAddr,
                amount: amountInNanotons,
            });

            await this.notifyTelegram(`Sent ${amount} TON to ${toAddress}`);
            return { success: true };
        } catch (e) {
            console.error('Transfer error:', e);
            return { success: false, error: e };
        }
    }

    async getBalance(address: string) {
        try {
            const addr = Address.parse(address);
            const balance = await this.client.getBalance(addr);
            return Number(balance) / 1e9;
        } catch (e) {
            console.error('Balance check error:', e);
            return null;
        }
    }

    async notifyTelegram(message: string) {
        const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: this.config.adminChatId,
                text: `[FINANCE]: ${message}`,
            }),
        });
    }

    async validatePayment(userWallet: string, expectedAmount: number): Promise<boolean> {
        const balance = await this.getBalance(userWallet);
        if (balance !== null && balance >= expectedAmount) {
            await this.notifyTelegram(`Payment validated for ${userWallet}`);
            return true;
        }
        return false;
    }

    async requestWithdrawal(user: string, amount: number, cardDetails?: string) {
        const details = cardDetails || 'BY26ALFA30145044920010270000';
        try {
            const message = `WITHDRAWAL REQUEST\nUser: ${user}\nAmount: ${amount} USDT\nCard: ${details}\nBank: Alpha Bank\nStatus: Pending Admin Confirmation`;
            await this.notifyTelegram(message);
            return { success: true, message: 'Request sent to admin' };
        } catch (e) {
            console.error('Withdrawal request error:', e);
            return { success: false, error: e };
        }
    }
}
