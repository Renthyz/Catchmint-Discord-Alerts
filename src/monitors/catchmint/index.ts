import { IMonitorService } from "../monitor.interface";
import { sleep } from "../../utils";
import { BASE_URL, MINTS_URL } from "./constants";
import fetch from "cross-fetch";
import sendWebhook from "../../utils/discord";

interface Mint {
    address: string;
    counts: Array<number>;
    imageURL: string;
    name: string;
    totalCounts: number;
    timestamp?: number;
}

interface MintInfo {
    address: string;
    deployedAt: string;
    deployer: string;
    deploymentTransactionHash: string;
    discordUrl: string;
    etherscanUrl: string;
    firstMint: string;
    flagCount: number;
    hasHidden: boolean;
    hideCount: number;
    imageUrl: string;
    isProxy: boolean;
    isVerified: boolean;
    lastMint: string;
    maxSupply: number;
    name: string;
    notableFlagCount: number;
    openseaUrl: string;
    standard: string;
    totalSupply: number;
    twitterUrl: string;
    uniqueWallets: number;
    websiteUrl: string;
    canInteractFromContract: boolean;
    commentCount: number;
}

export default class CatchMint implements IMonitorService {
    private delay: number;
    private window: number;
    private mintsPerMinutte: number;
    private targets: Array<Mint> = [];

    constructor(delay: number = 1000, window: number = 60, mintsPerMinutte: number = 10) {
        this.delay = delay;
        this.window = window;
        this.mintsPerMinutte = mintsPerMinutte;
    }

    async start() {
        while (true) {
            // Clearing old targets
            const currentTimestamp = Math.floor(Date.now() / 1000);
            this.targets.filter((target) => {
                if (target.timestamp && target.timestamp + 250 < currentTimestamp) {
                    return true;
                }
            });

            let mints;
            try {
                mints = await this.getMints();
            } catch (error: any) {
                console.log(`Failed to get mints: ${error}`);
                await sleep(this.delay);
                continue;
            }

            mints.forEach((mint) => {
                if (
                    this.targets.find((target) => target.address === mint.address) ||
                    mint.totalCounts < this.mintsPerMinutte
                ) {
                    return;
                }

                try {
                    console.log(`Found new mint: ${mint.name ? mint.name : mint.address} (${mint.totalCounts})`);
                    this.filterMint(mint);
                } catch (error: any) {
                    console.log(`Failed to filter mint: ${error}`);
                }
            });

            await sleep(this.delay);
        }
    }

    async getMints(): Promise<Array<Mint>> {
        try {
            const res = await fetch(`${MINTS_URL}/?window=60`);
            if (!res.ok) {
                throw new Error("Unexpected response");
            }

            return (await res.json()) as Array<Mint>;
        } catch (error: any) {
            throw new Error(`Failed to send request: ${error}`);
        }
    }

    async filterMint(mint: Mint): Promise<void> {
        const mintInfo = await this.getMintInfo(mint.address);
        const timestamp = new Date().toISOString();

        const usefulLinks = `
                ${mintInfo.openseaUrl ? `[Opensea](${mintInfo.openseaUrl})` : ""}${
            mintInfo.discordUrl ? ` | [Discord](${mintInfo.discordUrl})` : ""
        }${mintInfo.websiteUrl ? ` | [Website](${mintInfo.websiteUrl})` : ""}${
            mintInfo.twitterUrl ? ` | [Twitter](${mintInfo.twitterUrl})` : ""
        }${` | [Blur](https://blur.io/collection/${mintInfo.address})`}${` | [Etherscan](https://etherscan.io/address/${mintInfo.address}#writeContract)`}`;

        let title = mintInfo.name ? mintInfo.name : `\`\`\`${mint.address}\`\`\``;
        let uniqueMinters = mintInfo.uniqueWallets ? mintInfo.uniqueWallets.toString() : "Unknown";
        let totalMints = "Unknown";
        let desc = "";

        if (mintInfo.maxSupply && mintInfo.totalSupply) {
            totalMints = `${mintInfo.totalSupply} / ${mintInfo.maxSupply} (${(
                (mintInfo.totalSupply / mintInfo.maxSupply) *
                100
            ).toFixed(3)}%)`;
            desc = `(${((mint.totalCounts / mintInfo.maxSupply) * 100).toFixed(3)}% of total supply)`;
        } else if (mintInfo.totalSupply) {
            totalMints = `Total minted - ${mintInfo.totalSupply}`;
        } else if (mintInfo.maxSupply) {
            totalMints = `Max supply - ${mintInfo.maxSupply}`;
            desc = `(${((mint.totalCounts / mintInfo.maxSupply) * 100).toFixed(3)}% of total supply)`;
        }

        mint.timestamp = Math.floor(Date.now() / 1000);
        this.targets.push(mint);

        while (true) {
            try {
                await sendWebhook({
                    content: null,
                    embeds: [
                        {
                            title: title,
                            color: 5294200,
                            url: `https://catchmint.xyz/?address=${mintInfo.address}`,
                            description: `Has been minted ${mint.totalCounts} times ${desc} during last ${this.window} seconds`,
                            fields: [
                                {
                                    name: "Total Mints",
                                    value: totalMints,
                                    inline: true,
                                },
                                {
                                    name: "Unique Minters",
                                    value: uniqueMinters,
                                    inline: true,
                                },
                                {
                                    name: "Useful Links",
                                    value: usefulLinks,
                                    inline: false,
                                },
                            ],
                            footer: {
                                text: "CatchMint - Alerts",
                                icon_url:
                                    "https://cdn.discordapp.com/attachments/975521142192361514/1025346983621300304/unknown.png",
                            },
                            timestamp: timestamp,
                            thumbnail: {
                                url: mintInfo.imageUrl,
                            },
                            author: {
                                name: "New popular mint detected",
                            },
                        },
                    ],
                    username: "CatchMint - Alerts",
                    avatar_url:
                        "https://cdn.discordapp.com/attachments/975521142192361514/1025346983621300304/unknown.png",
                    attachments: [],
                });
                return;
            } catch (error: any) {
                console.log(`Failed to send webhook: ${error}`);
            }
        }
    }

    async getMintInfo(contractAddress: string): Promise<MintInfo> {
        try {
            const res = await fetch(`${BASE_URL}/contracts/${contractAddress}`);

            if (!res.ok) {
                throw new Error("Unexpected response");
            }

            return (await res.json()) as MintInfo;
        } catch (error: unknown) {
            throw new Error(`Failed to send request: ${error}` as string);
        }
    }
}
