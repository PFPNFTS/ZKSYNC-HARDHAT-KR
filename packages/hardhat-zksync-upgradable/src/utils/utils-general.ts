import { MaybeSolcOutput } from '../interfaces';
import { TOPIC_LOGS_NOT_FOUND_ERROR } from '../constants';
import { keccak256 } from 'ethereumjs-util';
import { Interface } from '@ethersproject/abi';
import chalk from 'chalk';
import * as zk from 'zksync-web3';
import { SolcConfig } from 'hardhat/types';

export type ContractAddressOrInstance = string | { address: string };

export function getContractAddress(addressOrInstance: ContractAddressOrInstance): string {
    if (typeof addressOrInstance === 'string') {
        return addressOrInstance;
    } else {
        return addressOrInstance.address;
    }
}

export function getInitializerData(
    contractInterface: Interface,
    args: unknown[],
    initializer?: string | false
): string {
    if (initializer === false) {
        return '0x';
    }

    const allowNoInitialization = initializer === undefined && args.length === 0;
    initializer = initializer ?? 'initialize';

    try {
        const fragment = contractInterface.getFunction(initializer);
        return contractInterface.encodeFunctionData(fragment, args);
    } catch (e: unknown) {
        if (e instanceof Error) {
            if (allowNoInitialization && e.message.includes('no matching function')) {
                return '0x';
            }
        }
        throw e;
    }
}

/**
 * Gets the constructor args from the given transaction input and creation code.
 *
 * @param txInput The transaction input that was used to deploy the contract.
 * @param creationCode The contract creation code.
 * @returns the encoded constructor args, or undefined if txInput does not start with the creationCode.
 */
export function inferConstructorArgs(txInput: string, creationCode: string) {
    return txInput.startsWith(creationCode) ? txInput.substring(creationCode.length) : undefined;
}

/**
 * Gets the txhash that created the contract at the given address, by calling the
 * RPC API to look for an event that should have been emitted during construction.
 *
 * @param provider The provider to use to call the RPC API.
 * @param address The address to get the creation txhash for.
 * @param topic The event topic string that should have been logged.
 * @returns The txhash corresponding to the logged event, or undefined if not found or if
 *   the address is not a contract.
 */
export async function getContractCreationTxHash(provider: zk.Provider, address: string, topic: string): Promise<any> {
    const params = {
        fromBlock: 0,
        toBlock: 'latest',
        address: address,
        topics: ['0x' + keccak256(Buffer.from(topic)).toString('hex')],
    };

    const logs = await provider.getLogs(params);

    if (logs.length > 0) {
        return logs[0].transactionHash; // get the txhash from the first instance of this event
    } else {
        console.warn(chalk.yellow(TOPIC_LOGS_NOT_FOUND_ERROR(topic, address)));
    }
}

export function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const res: Partial<Pick<T, K>> = {};
    for (const k of keys) {
        res[k] = obj[k];
    }
    return res as Pick<T, K>;
}

export function mapValues<V, W>(obj: Record<string, V>, fn: (value: V) => W): Record<string, W> {
    const res: Partial<Record<string, W>> = {};
    for (const k in obj) {
        res[k] = fn(obj[k]);
    }
    return res as Record<string, W>;
}

export function isFullZkSolcOutput(output: MaybeSolcOutput | undefined): boolean {
    if (output?.contracts == undefined || output?.sources == undefined) {
        return false;
    }

    for (const fileName of Object.keys(output.contracts)) {
        const file = output.contracts[fileName];
        if (file == undefined) {
            return false;
        }
    }

    for (const file of Object.values(output.sources)) {
        if (file?.ast == undefined || file?.id == undefined) {
            return false;
        }
    }

    return true;
}

export function isNullish(value: unknown): value is null | undefined {
    return value === null || value === undefined;
}

export function extendCompilerOutputSelection(compiler: SolcConfig) {
    if (!compiler.settings.outputSelection['*']['*'].find((o: string) => o == 'storageLayout')) {
        compiler.settings.outputSelection['*']['*'].push('storageLayout');
    }
}
