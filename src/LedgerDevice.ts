import { DeviceStrategy } from './DeviceStrategy';
import Eth from '@ledgerhq/hw-app-eth';
import {
    CHAIN_ID_SIZE,
    CHUNK_SIZE,
    CLA,
    CLA_ETH,
    COLLECTION_NAME_MAX_LEN,
    ADDRESS_LENGTH,
    ALGORITHM_ID_1,
    ALGORITHM_ID_SIZE,
    TYPE_SIZE,
    VERSION_SIZE,
    SIGNATURE_LENGTH_SIZE,
    CONTRACT_ADDRESS_LEN,
    errorCodeToString,
    FIRST_MESSAGE,
    getVersion,
    HASH_LEN,
    INS,
    LAST_MESSAGE,
    LedgerError,
    NEXT_MESSAGE,
    P1_VALUES,
    PAYLOAD_TYPE,
    processErrorResponse,
    TYPE_1,
    VERSION_1,
} from './common'
import { EIP712Message } from '@ledgerhq/types-live';
import { ResponseWalletId } from './types';
import Transport from '@ledgerhq/hw-transport'
import { LedgerEthTransactionResolution, LoadConfig, ResolutionConfig } from '@ledgerhq/hw-app-eth/lib/services/types'

export class LedgerDevice implements DeviceStrategy {
    private transport: Transport;
    private eth: Eth;

    constructor(eth: Eth, transport: Transport) {
        this.transport = transport;
        this.eth = eth;
    }

    //   async signEIP712Message(path: string, jsonMessage: EIP712Message, fullImplem = false): Promise<{ v: number; s: string; r: string }> {
    //     return this.eth.signEIP712Message(path, jsonMessage, fullImplem);
    //   }

    private async _walletId(show: boolean): Promise<ResponseWalletId> {
        const p1 = show ? P1_VALUES.SHOW_ADDRESS_IN_DEVICE : P1_VALUES.ONLY_RETRIEVE;

        return this.transport.send(CLA, INS.WALLET_ID, p1, 0).then(
            (response) => {
                const errorCodeData = response.slice(-2);
                const returnCode = (errorCodeData[0] * 256 + errorCodeData[1]) as LedgerError;

                return {
                    returnCode,
                    errorMessage: errorCodeToString(returnCode),
                    id: response.slice(0, 6),
                };
            },
            (err) => {
                throw err; // 处理错误
            }
        );
    }

    async getWalletId(): Promise<ResponseWalletId> {
        return this._walletId(false);
    }

    async showWalletId(): Promise<ResponseWalletId> {
        return this._walletId(true);
    }

    async signEVMTransaction(
        path: string,
        rawTxHex: string,
        resolution?: LedgerEthTransactionResolution | null
    ): Promise<{
        s: string;
        v: string;
        r: string;
    }> {
        return this.eth.signTransaction(path, rawTxHex, resolution || undefined);
    }

    getETHAddress(
        path: string,
        boolDisplay?: boolean,
        boolChaincode?: boolean,
    ): Promise<{
        publicKey: string
        address: string
        chainCode?: string
    }> {
        return this.eth.getAddress(path, boolDisplay, boolChaincode)
    }

    async getAppConfiguration(): Promise<{
        arbitraryDataEnabled: number;
        erc20ProvisioningNecessary: number;
        starkEnabled: number;
        starkv2Supported: number;
        version: string;
    }> {
        return this.eth.getAppConfiguration();
    }

    private _generateFakeDerSignature(): Buffer {
        const fakeSignatureLength = 70
        const fakeDerSignature = Buffer.alloc(fakeSignatureLength)

        // Fill the buffer with random bytes
        for (let i = 0; i < fakeSignatureLength; i++) {
            fakeDerSignature[i] = Math.floor(Math.random() * 256)
        }

        return fakeDerSignature
    }

    async provideNFTInformation(
        collectionName: string,
        contractAddress: string,
        chainId: bigint
    ): Promise<boolean> {
        const NAME_LENGTH_SIZE = 1;
        const HEADER_SIZE = TYPE_SIZE + VERSION_SIZE + NAME_LENGTH_SIZE;
        const KEY_ID_SIZE = 1;
        const PROD_NFT_METADATA_KEY = 1;

        const collectionNameLength = Buffer.byteLength(collectionName, 'utf8');

        if (collectionNameLength > COLLECTION_NAME_MAX_LEN) {
            throw new Error(`Collection name exceeds maximum allowed length of ${COLLECTION_NAME_MAX_LEN}`);
        }

        // We generate a fake signature, because verification is disabled in the app.
        const fakeDerSignature = this._generateFakeDerSignature();

        const buffer = Buffer.alloc(
            HEADER_SIZE +
            collectionNameLength +
            ADDRESS_LENGTH +
            CHAIN_ID_SIZE +
            KEY_ID_SIZE +
            ALGORITHM_ID_SIZE +
            SIGNATURE_LENGTH_SIZE +
            fakeDerSignature.length,
        );

        let offset = 0;

        buffer.writeUInt8(TYPE_1, offset);
        offset += TYPE_SIZE;

        buffer.writeUInt8(VERSION_1, offset);
        offset += VERSION_SIZE;

        buffer.writeUInt8(collectionNameLength, offset);
        offset += NAME_LENGTH_SIZE;

        buffer.write(collectionName, offset, 'utf8');
        offset += collectionNameLength;

        Buffer.from(contractAddress.slice(2), 'hex').copy(new Uint8Array(buffer), offset); // Remove '0x' from address
        offset += ADDRESS_LENGTH;

        buffer.writeBigUInt64BE(chainId, offset);
        offset += CHAIN_ID_SIZE;

        buffer.writeUInt8(PROD_NFT_METADATA_KEY, offset); // Assume production key for simplicity
        offset += KEY_ID_SIZE;

        buffer.writeUInt8(ALGORITHM_ID_1, offset); // Assume a specific algorithm for signature or hash
        offset += ALGORITHM_ID_SIZE;

        buffer.writeUInt8(fakeDerSignature.length, offset);
        offset += SIGNATURE_LENGTH_SIZE;

        fakeDerSignature.copy(new Uint8Array(buffer), offset);

        return this.eth.provideNFTInformation(buffer.toString('hex'));
    }

    // We assume pluginName is ERC721 for Nft tokens
    async setPlugin(
        contractAddress: string,
        methodSelector: string,
        chainId: bigint
    ): Promise<boolean> {
        const KEY_ID = 2;
        const PLUGIN_NAME_LENGTH_SIZE = 1;
        const KEY_ID_SIZE = 1;
        const PLUGIN_NAME = 'ERC721';

        const pluginNameBuffer = Buffer.from(PLUGIN_NAME, 'utf8');
        const pluginNameLength = pluginNameBuffer.length;

        const contractAddressBuffer = Buffer.from(contractAddress.slice(2), 'hex');
        const methodSelectorBuffer = Buffer.from(methodSelector.slice(2), 'hex');

        // We generate a fake signature, because verification is disabled in the app.
        const signatureBuffer = this._generateFakeDerSignature();
        const signatureLength = signatureBuffer.length;

        const buffer = Buffer.alloc(
            TYPE_SIZE +
            VERSION_SIZE +
            PLUGIN_NAME_LENGTH_SIZE +
            pluginNameLength +
            contractAddressBuffer.length +
            methodSelectorBuffer.length +
            CHAIN_ID_SIZE +
            KEY_ID_SIZE +
            ALGORITHM_ID_SIZE +
            SIGNATURE_LENGTH_SIZE +
            signatureLength,
        );

        let offset = 0;

        buffer.writeUInt8(TYPE_1, offset);
        offset += TYPE_SIZE;

        buffer.writeUInt8(VERSION_1, offset);
        offset += VERSION_SIZE;

        buffer.writeUInt8(pluginNameLength, offset);
        offset += PLUGIN_NAME_LENGTH_SIZE;

        pluginNameBuffer.copy(new Uint8Array(buffer), offset);
        offset += pluginNameLength;

        contractAddressBuffer.copy(new Uint8Array(buffer), offset);
        offset += contractAddressBuffer.length;

        methodSelectorBuffer.copy(new Uint8Array(buffer), offset);
        offset += methodSelectorBuffer.length;

        buffer.writeBigUInt64BE(BigInt(chainId), offset);
        offset += CHAIN_ID_SIZE;

        // use default key_id
        buffer.writeUInt8(KEY_ID, offset);
        offset += KEY_ID_SIZE;

        // use default algorithm
        buffer.writeUInt8(ALGORITHM_ID_1, offset);
        offset += ALGORITHM_ID_SIZE;

        buffer.writeUInt8(signatureLength, offset);
        offset += SIGNATURE_LENGTH_SIZE;

        signatureBuffer.copy(new Uint8Array(buffer), offset);

        return this.eth.setPlugin(buffer.toString('hex'));
    }
}
