import { cac } from "cac";
import * as commands from "./commands";

const cli = cac("uppsyncd");

cli
	.command("install", "Install uppsyncd as a system service")
	.action(commands.install);
cli
	.command("uninstall", "Remove the uppsyncd system service")
	.action(commands.uninstall);
cli.command("start", "Start the uppsyncd service").action(commands.start);
cli.command("stop", "Stop the uppsyncd service").action(commands.stop);
cli.command("restart", "Restart the uppsyncd service").action(commands.restart);
cli.command("status", "Show service status").action(commands.status);

cli
	.command("update", "Update uppsyncd to the latest version")
	.action(commands.update);
cli
	.command("run", "Run uppsyncd in foreground (no service)")
	.option("--metrics", "Enable metrics collection")
	.action(commands.run);
cli.command("version", "Print version").action(commands.version);

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
}
