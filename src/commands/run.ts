import { startMetricsCollection } from "../lib/metrics";

interface RunOptions {
	metrics?: boolean;
}

export async function run(options: RunOptions) {
	console.log("Starting uppsyncd agent...");

	if (options.metrics) {
		startMetricsCollection();
	} else {
		console.log("uppsyncd agent is running (no metrics).");
		// Keep alive
		setInterval(() => {}, 10000);
	}
}
