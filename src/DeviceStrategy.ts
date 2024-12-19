import { EIP712Message } from '@ledgerhq/types-live';
import { ResponseWalletId, ResponseAppInfo } from './types';
import { LedgerEthTransactionResolution, LoadConfig, ResolutionConfig } from '@ledgerhq/hw-app-eth/lib/services/types'

export interface DeviceStrategy {
    getExtendedPubKey(
        path: string,
        show: boolean,
        hrp?: string,
        chainid?: string
    ): Promise<any>;

    getAppInfo(
    ): Promise<ResponseAppInfo>;

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

    provideERC20TokenInformation(
        ticker: string,
        contractName: string,
        address: string,
        decimals: number,
        chainId: number
    ): Promise<boolean>;

    clearSignTransaction(
        path: string,
        rawTxHex: string,
        resolutionConfig: ResolutionConfig,
        throwOnError?: boolean
    ): Promise<{ r: string; s: string; v: string }>;

    // signEIP712Message(path: string, jsonMessage: EIP712Message, fullImplem?: boolean): Promise<{ v: number; s: string; r: string }>;

    signEIP712HashedMessage(
        path: string,
        domainSeparatorHex: string,
        hashStructMessageHex: string
    ): Promise<{ v: number; s: string; r: string }>;
}
