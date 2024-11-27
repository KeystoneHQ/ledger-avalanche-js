import { DeviceStrategy } from './DeviceStrategy';
import { Eth as KeystoneEth } from '@keystonehq/hw-app-eth';
import { EIP712Message } from '@ledgerhq/types-live';
import { ResponseWalletId } from './types';

export class KeystoneDevice implements DeviceStrategy {
  private eth: KeystoneEth;

  constructor(eth: KeystoneEth) {
    this.eth = eth;
  }

  //   async signEIP712Message(path: string, jsonMessage: EIP712Message): Promise<{ v: number; s: string; r: string }> {
  //     return this.eth.signEIP712Message(path, jsonMessage as Object);
  //   }

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
}
