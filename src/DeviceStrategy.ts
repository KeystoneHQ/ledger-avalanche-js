import { EIP712Message } from '@ledgerhq/types-live';
import { ResponseWalletId } from './types';
import { LedgerEthTransactionResolution, LoadConfig, ResolutionConfig } from '@ledgerhq/hw-app-eth/lib/services/types'

export interface DeviceStrategy {
    //   signEIP712Message(path: string, jsonMessage: EIP712Message, fullImplem?: boolean): Promise<{ v: number; s: string; r: string }>;
    getWalletId(): Promise<ResponseWalletId>;
    showWalletId(): Promise<ResponseWalletId>;
    signEVMTransaction(
        path: string,
        rawTxHex: string,
        resolution?: LedgerEthTransactionResolution | null,
    ): Promise<{
        s: string
        v: string
        r: string
    }>;
    getETHAddress(
        path: string,
        boolDisplay?: boolean,
        boolChaincode?: boolean,
    ): Promise<{
        publicKey: string
        address: string
        chainCode?: string
    }>

    getAppConfiguration(): Promise<{
        arbitraryDataEnabled: number;
        erc20ProvisioningNecessary: number;
        starkEnabled: number;
        starkv2Supported: number;
        version: string;
    }>;

    provideNFTInformation(
        collectionName: string,
        contractAddress: string,
        chainId: bigint
    ): Promise<boolean>;

    setPlugin(
        contractAddress: string,
        methodSelector: string,
        chainId: bigint
    ): Promise<boolean>;
}
