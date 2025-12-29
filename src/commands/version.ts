// Import package.json to get the semantic version
import pkg from "../../package.json";

export function version() {
    // 1. The Main Version
    console.log(pkg.version);

    // 2. The Details
    const commit = process.env.GIT_COMMIT || "unknown-dev-build";
    const date = process.env.BUILD_DATE || new Date().toISOString();
    const bunVer = process.version; // Bun runtime version
    const arch = `${process.platform}-${process.arch}`;

    console.log(`  uppsync commit: ${commit}`);
    console.log(`  build date:     ${date}`);
    console.log(`  bun version:    ${bunVer}`);
    console.log(`  arch:           ${arch}`);
}
