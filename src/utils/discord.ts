import fetch from "cross-fetch";

export default async function sendWebhook(webhook: object): Promise<void> {
    const url = process.env.DISCORD_WEBHOOK_URL as string;
    const response = await fetch(url, {
        method: "POST",
        body: JSON.stringify(webhook),
        headers: { "Content-Type": "application/json" },
    });

    if (response.status == 204) {
        return;
    }

    throw new Error(`Failed to send discord webhook: ${response.statusText}`);
}
