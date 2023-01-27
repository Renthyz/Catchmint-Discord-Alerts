import { CatchMint } from "./monitors";
import { config } from "dotenv";

async function main() {
    config();
    console.log(`Starting CatchMint monitor...`);
    const monitor = new CatchMint();
    monitor.start();
}

main();
