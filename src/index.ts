/** ******************************************************************************
 *  (c) 2019-2020 Zondax GmbH
 *  (c) 2016-2017 Ledger
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 ******************************************************************************* */
import { DeviceStrategy } from './DeviceStrategy';
import { KeystoneDevice } from './KeystoneDevice';
import { LedgerDevice } from './LedgerDevice';
import Transport from '@ledgerhq/hw-transport'
import { TransportWebUSB } from '@keystonehq/hw-transport-webusb';
import { Eth as KeystoneEth } from '@keystonehq/hw-app-eth'
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
import { pathCoinType, serializeChainID, serializeHrp, serializePath, serializePathSuffix } from './helper'
import { ResponseAddress, ResponseAppInfo, ResponseBase, ResponseSign, ResponseVersion, ResponseWalletId, ResponseXPub } from './types'

import Eth from '@ledgerhq/hw-app-eth'

import { LedgerEthTransactionResolution, LoadConfig, ResolutionConfig } from '@ledgerhq/hw-app-eth/lib/services/types'

export * from './types'
export { LedgerError }

enum HWDevice {
  KEYSTONE = 'keystone',
  LEDGER = 'ledger'
}

function processGetAddrResponse(response: Buffer) {
  let partialResponse = response

  const errorCodeData = partialResponse.slice(-2)
  const returnCode = errorCodeData[0] * 256 + errorCodeData[1]

  //get public key len (variable)
  const PKLEN = partialResponse[0]
  const publicKey = Buffer.from(partialResponse.slice(1, 1 + PKLEN))

  //"advance" buffer
  partialResponse = partialResponse.slice(1 + PKLEN)

  const hash = Buffer.from(partialResponse.slice(0, 20))

  //"advance" buffer
  partialResponse = partialResponse.slice(20)

  const address = Buffer.from(partialResponse.subarray(0, -2)).toString()

  return {
    publicKey,
    hash,
    address,
    returnCode,
    errorMessage: errorCodeToString(returnCode),
  }
}

export default class AvalancheApp {
  private strategy: DeviceStrategy;

  constructor(transport: Transport | TransportWebUSB, ethScrambleKey = 'w0w', ethLoadConfig = {}) {
    if (!transport) {
      throw new Error('Transport has not been defined');
    }
    
    let ethInstance;
    if (transport instanceof Transport) {
      ethInstance = new Eth(transport, ethScrambleKey, ethLoadConfig);
      this.strategy = new LedgerDevice(ethInstance as Eth, transport);
    } else {
      ethInstance = new KeystoneEth(transport);
      this.strategy = new KeystoneDevice(ethInstance as KeystoneEth);
    }
  }

  private static prepareChunks(message: Buffer, serializedPathBuffer?: Buffer) {
    const chunks = []

    // First chunk (only path)
    if (serializedPathBuffer !== undefined) {
      // First chunk (only path)
      chunks.push(serializedPathBuffer)
    }

    const buffer = Buffer.from(message)
    for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
      let end = i + CHUNK_SIZE
      if (i > buffer.length) {
        end = buffer.length
      }
      chunks.push(buffer.slice(i, end))
    }

    return chunks
  }

  private async signGetChunks(message: Buffer, path?: string) {
    if (path === undefined) {
      return AvalancheApp.prepareChunks(message, Buffer.alloc(0))
    } else {
      return AvalancheApp.prepareChunks(message, serializePath(path))
    }
  }

  // private concatMessageAndChangePath(message: Buffer, path?: Array<string>): Buffer {
  //   // data
  //   const msg = message
  //   // no change_path
  //   if (path === undefined) {
  //     const buffer = Buffer.alloc(1)
  //     buffer.writeUInt8(0)
  //     return Buffer.concat([new Uint8Array(buffer), new Uint8Array(msg)])
  //   } else {
  //     let buffer = Buffer.alloc(1)
  //     buffer.writeUInt8(path.length)
  //     path.forEach(element => {
  //       buffer = Buffer.concat([new Uint8Array(buffer), new Uint8Array(serializePathSuffix(element))])
  //     })
  //     return Buffer.concat([new Uint8Array(buffer), new Uint8Array(msg)])
  //   }
  // }

  // private async signSendChunk(
  //   chunkIdx: number,
  //   chunkNum: number,
  //   chunk: Buffer,
  //   param?: number,
  //   ins: number = INS.SIGN,
  // ): Promise<ResponseSign> {
  //   let payloadType = PAYLOAD_TYPE.ADD
  //   let p2 = 0
  //   if (chunkIdx === 1) {
  //     payloadType = PAYLOAD_TYPE.INIT
  //     if (param === undefined) {
  //       throw Error('number type not given')
  //     }
  //     p2 = param
  //   }
  //   if (chunkIdx === chunkNum) {
  //     payloadType = PAYLOAD_TYPE.LAST
  //   }

  //   return this.transport
  //     .send(CLA, ins, payloadType, p2, chunk, [
  //       LedgerError.NoErrors,
  //       LedgerError.DataIsInvalid,
  //       LedgerError.BadKeyHandle,
  //       LedgerError.SignVerifyError,
  //     ])
  //     .then((response: Buffer) => {
  //       const errorCodeData = response.slice(-2)
  //       const returnCode = errorCodeData[0] * 256 + errorCodeData[1]
  //       let errorMessage = errorCodeToString(returnCode)

  //       if (
  //         returnCode === LedgerError.BadKeyHandle ||
  //         returnCode === LedgerError.DataIsInvalid ||
  //         returnCode === LedgerError.SignVerifyError
  //       ) {
  //         errorMessage = `${errorMessage} : ${response.slice(0, response.length - 2).toString('ascii')}`
  //       }

  //       if (returnCode === LedgerError.NoErrors && response.length > 2) {
  //         return {
  //           hash: null,
  //           signature: null,
  //           returnCode: returnCode,
  //           errorMessage: errorMessage,
  //         }
  //       }

  //       return {
  //         returnCode: returnCode,
  //         errorMessage: errorMessage,
  //       }
  //     }, processErrorResponse)
  // }

  // async signHash(path_prefix: string, signing_paths: Array<string>, hash: Buffer): Promise<ResponseSign> {
  //   if (hash.length !== HASH_LEN) {
  //     throw new Error('Invalid hash length')
  //   }

  //   //send hash and path
  //   const first_response = await this.transport
  //     .send(CLA, INS.SIGN_HASH, FIRST_MESSAGE, 0x00, Buffer.concat([new Uint8Array(serializePath(path_prefix)), new Uint8Array(hash)]), [LedgerError.NoErrors])
  //     .then((response: Buffer) => {
  //       const errorCodeData = response.slice(-2)
  //       const returnCode = errorCodeData[0] * 256 + errorCodeData[1]
  //       let errorMessage = errorCodeToString(returnCode)

  //       if (returnCode === LedgerError.BadKeyHandle || returnCode === LedgerError.DataIsInvalid) {
  //         errorMessage = `${errorMessage} : ${response.slice(0, response.length - 2).toString('ascii')}`
  //       }
  //       return {
  //         returnCode: returnCode,
  //         errorMessage: errorMessage,
  //       }
  //     }, processErrorResponse)

  //   if (first_response.returnCode !== LedgerError.NoErrors) {
  //     return first_response
  //   }

  //   return this._signAndCollect(signing_paths)
  // }

  // private async _signAndCollect(signing_paths: Array<string>): Promise<ResponseSign> {
  //   // base response object to output on each iteration
  //   const result = {
  //     returnCode: LedgerError.NoErrors,
  //     errorMessage: '',
  //     hash: null,
  //     signatures: null as null | Map<string, Buffer>,
  //   }

  //   // where each pair path_suffix, signature are stored
  //   const signatures = new Map()

  //   for (let idx = 0; idx < signing_paths.length; idx++) {
  //     const suffix = signing_paths[idx]
  //     const path_buf = serializePathSuffix(suffix)

  //     const p1 = idx >= signing_paths.length - 1 ? LAST_MESSAGE : NEXT_MESSAGE

  //     // send path to sign hash that should be in device's ram memory
  //     await this.transport
  //       .send(CLA, INS.SIGN_HASH, p1, 0x00, path_buf, [
  //         LedgerError.NoErrors,
  //         LedgerError.DataIsInvalid,
  //         LedgerError.BadKeyHandle,
  //         LedgerError.SignVerifyError,
  //       ])
  //       .then((response: Buffer) => {
  //         const errorCodeData = response.slice(-2)
  //         const returnCode = errorCodeData[0] * 256 + errorCodeData[1]
  //         const errorMessage = errorCodeToString(returnCode)

  //         if (
  //           returnCode === LedgerError.BadKeyHandle ||
  //           returnCode === LedgerError.DataIsInvalid ||
  //           returnCode === LedgerError.SignVerifyError
  //         ) {
  //           result.errorMessage = `${errorMessage} : ${response.slice(0, response.length - 2).toString('ascii')}`
  //         }

  //         if (returnCode === LedgerError.NoErrors && response.length > 2) {
  //           signatures.set(suffix, response.slice(0, -2))
  //         }

  //         result.returnCode = returnCode
  //         result.errorMessage = errorMessage

  //         return
  //       }, processErrorResponse)

  //     if (result.returnCode !== LedgerError.NoErrors) {
  //       break
  //     }
  //   }
  //   result.signatures = signatures
  //   return result
  // }

  // async sign(path_prefix: string, signing_paths: Array<string>, message: Buffer, change_paths?: Array<string>): Promise<ResponseSign> {
  //   // Do not show outputs that go to the signers
  //   let paths = signing_paths
  //   if (change_paths !== undefined) {
  //     // remove duplication just is case
  //     paths = [...new Set([...paths, ...change_paths])]
  //   }

  //   // Prepend change_paths to the message as the device do set which outputs should be
  //   // shown at parsing
  //   const msg = this.concatMessageAndChangePath(message, paths)

  //   // Send transaction for review
  //   const response = await this.signGetChunks(msg, path_prefix).then(chunks => {
  //     return this.signSendChunk(1, chunks.length, chunks[0], FIRST_MESSAGE, INS.SIGN).then(async response => {
  //       // initialize response
  //       let result = {
  //         returnCode: response.returnCode,
  //         errorMessage: response.errorMessage,
  //         signatures: null as null | Map<string, Buffer>,
  //       }

  //       // send chunks
  //       for (let i = 1; i < chunks.length; i += 1) {
  //         // eslint-disable-next-line no-await-in-loop
  //         result = await this.signSendChunk(1 + i, chunks.length, chunks[i], NEXT_MESSAGE, INS.SIGN)
  //         if (result.returnCode !== LedgerError.NoErrors) {
  //           break
  //         }
  //       }
  //       return result
  //     }, processErrorResponse)
  //   }, processErrorResponse)

  //   if (response.returnCode !== LedgerError.NoErrors) {
  //     return response
  //   }

  //   // Transaction was approved so start iterating over signing_paths to sign
  //   // and collect each signature
  //   return this._signAndCollect(signing_paths)
  // }

  // // Sign an arbitrary message.
  // // This function takes in an avax path prefix like: m/44'/9000'/0'/0'
  // // signing_paths: ["0/1", "5/8"]
  // // message: The message to be signed
  // async signMsg(path_prefix: string, signing_paths: Array<string>, message: string): Promise<ResponseSign> {
  //   const coinType = pathCoinType(path_prefix)

  //   if (coinType !== "9000'") {
  //     throw new Error('Only avax path is supported')
  //   }

  //   const header = Buffer.from('\x1AAvalanche Signed Message:\n', 'utf8')

  //   const content = Buffer.from(message, 'utf8')

  //   const msgSize = Buffer.alloc(4)
  //   msgSize.writeUInt32BE(content.length, 0)

  //   const avax_msg = Buffer.from(`${header}${msgSize}${content}`, 'utf8')

  //   // Send msg for review
  //   const response = await this.signGetChunks(avax_msg, path_prefix).then(chunks => {
  //     return this.signSendChunk(1, chunks.length, chunks[0], FIRST_MESSAGE, INS.SIGN_MSG).then(async response => {
  //       // initialize response
  //       let result = {
  //         returnCode: response.returnCode,
  //         errorMessage: response.errorMessage,
  //         signatures: null as null | Map<string, Buffer>,
  //       }

  //       // send chunks
  //       for (let i = 1; i < chunks.length; i += 1) {
  //         // eslint-disable-next-line no-await-in-loop
  //         result = await this.signSendChunk(1 + i, chunks.length, chunks[i], NEXT_MESSAGE, INS.SIGN_MSG)
  //         if (result.returnCode !== LedgerError.NoErrors) {
  //           break
  //         }
  //       }
  //       return result
  //     }, processErrorResponse)
  //   }, processErrorResponse)

  //   if (response.returnCode !== LedgerError.NoErrors) {
  //     return response
  //   }

  //   // Message was approved so start iterating over signing_paths to sign
  //   // and collect each signature
  //   return this._signAndCollect(signing_paths)
  // }

  // async getVersion(): Promise<ResponseVersion> {
  //   return getVersion(this.transport).catch(err => processErrorResponse(err))
  // }
  async getAppInfo(): Promise<ResponseAppInfo> {
    return this.strategy.getAppInfo()
  }

  // private async _pubkey(path: string, show: boolean, hrp?: string, chainid?: string): Promise<ResponseAddress> {
  //   const p1 = show ? P1_VALUES.SHOW_ADDRESS_IN_DEVICE : P1_VALUES.ONLY_RETRIEVE
  //   const serializedPath = serializePath(path)
  //   const serializedHrp = serializeHrp(hrp)
  //   const serializedChainID = serializeChainID(chainid)

  //   return this.transport
  //     .send(CLA, INS.GET_ADDR, p1, 0, Buffer.concat([new Uint8Array(serializedHrp), new Uint8Array(serializedChainID), new Uint8Array(serializedPath)]), [LedgerError.NoErrors])
  //     .then(processGetAddrResponse, processErrorResponse)
  // }

  // async getAddressAndPubKey(path: string, show: boolean, hrp?: string, chainid?: string) {
  //   return this._pubkey(path, show, hrp, chainid)
  // }

  async getExtendedPubKey(path: string, show: boolean, hrp?: string, chainid?: string) {
    return this.strategy.getExtendedPubKey(path, show, hrp, chainid)
  }

  async getWalletId(): Promise<ResponseWalletId> {
    return this.strategy.getWalletId();
  }

  async showWalletId(): Promise<ResponseWalletId> {
    return this.strategy.showWalletId();
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
    return this.strategy.signEVMTransaction(path, rawTxHex, resolution);
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
    return this.strategy.getETHAddress(path, boolDisplay, boolChaincode)
  }

  async getAppConfiguration(): Promise<{
    arbitraryDataEnabled: number;
    erc20ProvisioningNecessary: number;
    starkEnabled: number;
    starkv2Supported: number;
    version: string;
  }> {
    return this.strategy.getAppConfiguration();
  }

  async provideERC20TokenInformation(
    ticker: string,
    contractName: string,
    address: string,
    decimals: number,
    chainId: number
  ): Promise<boolean> {
    return this.strategy.provideERC20TokenInformation(ticker, contractName, address, decimals, chainId);
  }

  async provideNFTInformation(
    collectionName: string,
    contractAddress: string,
    chainId: bigint
  ): Promise<boolean> {
    return this.strategy.provideNFTInformation(collectionName, contractAddress, chainId);
  }

  async setPlugin(
    contractAddress: string,
    methodSelector: string,
    chainId: bigint
  ): Promise<boolean> {
    return this.strategy.setPlugin(contractAddress, methodSelector, chainId);
  }

  async clearSignTransaction(
    path: string,
    rawTxHex: string,
    resolutionConfig: ResolutionConfig,
    throwOnError = false
  ): Promise<{ r: string; s: string; v: string }> {
    return this.strategy.clearSignTransaction(path, rawTxHex, resolutionConfig, throwOnError);
  }

  // async signEIP712Message(path: string, jsonMessage: EIP712Message, fullImplem = false): Promise<{ v: number; s: string; r: string }> {
  //   return this.strategy.signEIP712Message(path, jsonMessage, fullImplem);
  // }

  async signEIP712HashedMessage(
    path: string,
    domainSeparatorHex: string,
    hashStructMessageHex: string,
  ): Promise<{ v: number; s: string; r: string }> {
    return this.strategy.signEIP712HashedMessage(path, domainSeparatorHex, hashStructMessageHex)
  }
}
