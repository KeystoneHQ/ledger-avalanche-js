import { DeviceStrategy } from './DeviceStrategy';
import { Eth as KeystoneEth } from '@keystonehq/hw-app-eth';
import { EIP712Message } from '@ledgerhq/types-live';
import { ResponseWalletId, ResponseAppInfo } from './types';
import { ResolutionConfig } from '@ledgerhq/hw-app-eth/lib/services/types';

export class KeystoneDevice implements DeviceStrategy {
  private eth: KeystoneEth;

  constructor(eth: KeystoneEth) {
    this.eth = eth;
  }

  getAppInfo(): Promise<ResponseAppInfo> {
    let appName = "Avalanche";
  
    return Promise.resolve({
      appName,
      appVersion: "",
      flagLen: 0,
      flagsValue: 0,
      flagRecovery: false,
      flagSignedMcuCode: false,
      flagOnboarded: false,
      flagPINValidated: false,
      errorMessage: "",
      returnCode: 0,
    });
  }

  async getExtendedPubKey(
    path: string,
    show: boolean,
    hrp?: string,
    chainid?: string
  ): Promise<any> {
    // @todo
    return Promise.reject(new Error('Keystone does not support extended public key retrieval.'));
  }

  async getWalletId(): Promise<ResponseWalletId> {
    return {
      returnCode: 0,
      errorMessage: '',
      id: Buffer.alloc(6),
    };
  }

  async showWalletId(): Promise<ResponseWalletId> {
    return {
      returnCode: 0,
      errorMessage: '',
      id: Buffer.alloc(6),
    };
  }

  async signEVMTransaction(
    path: string,
    rawTxHex: string,
    resolution?: null
  ): Promise<{
    s: string;
    v: string;
    r: string;
  }> {
    return this.eth.signTransaction(path, rawTxHex);
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
    return Promise.resolve({
      arbitraryDataEnabled: 0,
      erc20ProvisioningNecessary: 0,
      starkEnabled: 0,
      starkv2Supported: 0,
      version: '0.0.0',
    });
  }

  async provideNFTInformation(
    collectionName: string,
    contractAddress: string,
    chainId: bigint
  ): Promise<boolean> {
    return Promise.reject(new Error('Keystone does not support NFT information provision.'));
  }

  async setPlugin(
    contractAddress: string,
    methodSelector: string,
    chainId: bigint
  ): Promise<boolean> {
    return Promise.reject(new Error('Keystone does not support setPlugin operation.'));
  }

  async provideERC20TokenInformation(
    ticker: string,
    contractName: string,
    address: string,
    decimals: number,
    chainId: number
  ): Promise<boolean> {
    return Promise.reject(new Error('Keystone does not support ERC20 token information provision.'));
  }

  async clearSignTransaction(
    path: string,
    rawTxHex: string,
    resolutionConfig: ResolutionConfig,
    throwOnError = false
  ): Promise<{ r: string; s: string; v: string }> {
    return Promise.reject(new Error('Keystone does not support clearSignTransaction.'));
  }

  // async signEIP712Message(path: string, jsonMessage: EIP712Message): Promise<{ v: number; s: string; r: string }> {
  //   return this.eth.signEIP712Message(path, jsonMessage as Object);
  // }

  async signEIP712HashedMessage(
    path: string,
    domainSeparatorHex: string,
    hashStructMessageHex: string
  ): Promise<{ v: number; s: string; r: string }> {
    return Promise.reject(new Error('Keystone does not support signing EIP-712 hashed messages.'));
  }
}
