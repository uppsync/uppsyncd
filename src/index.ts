import { cac } from "cac";
import * as actions from "./actions";
import type { RunOptions } from "./types";

const cli = cac("uppsyncd");

cli
	.command("up", "Install, configure, and start the uppsyncd service")
	.option("--token [token]", "Uppsync token")
	.option("--metrics", "Enable system metrics collection", { default: true })
	.action(async (options: RunOptions) => {
		console.log("Setting up uppsyncd service...", options);
		if (!options.token) {
			options.token = await actions.login();
		}
		await actions.install(options);
		await actions.start();
	});

cli.command("down", "Stop the uppsyncd service").action(actions.stop);

cli
	.command("update", "Update uppsyncd to the latest version")
	.action(actions.update);

cli
	.command("run", "Run uppsyncd in foreground")
	.option("--metrics", "Enable system metrics collection")
	.action(actions.run);

cli.command("version", "Print version").action(actions.version);

cli.help();

try {
	cli.parse();
} catch (error) {
	if (error instanceof Error && error.message.includes("Unknown command")) {
		console.error(`Unknown command "${process.argv[2]}".`);
		console.error("Run 'uppsyncd --help' for usage.");
		process.exit(1);
	}
	console.error(error);
	process.exit(1);
}
