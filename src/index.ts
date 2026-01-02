import { cac } from "cac";
import * as commands from "./commands";

const cli = cac("uppsyncd");

cli
	.command("update", "Update uppsyncd to the latest version")
	.action(commands.update);

cli.command("version", "Print the version").action(commands.version);

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
