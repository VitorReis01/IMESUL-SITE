// Test process only: emulate Next's server-only marker and extensionless local imports.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: new URL("../stubs/server-only.js", import.meta.url).href, shortCircuit: true };
  }
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(`${specifier}.js`, context);
    }
    throw error;
  }
}

// Fault injection exists only in this test loader, never in application code.
export async function load(url, context, nextLoad) {
  if (url.endsWith('/Backend.js/db.js') && process.env.ROTATION_TEST_FAULT) {
    const { readFile } = await import('node:fs/promises');
    let source = await readFile(new URL(url), 'utf8');
    const marker = 'await client.query("COMMIT");';
    if (!source.includes(marker)) throw new Error('Commit injection point changed');
    source = source.replace(marker, process.env.ROTATION_TEST_FAULT === 'after-commit'
      ? `${marker} process.exit(73);`
      : 'throw new Error("injected rollback before commit");');
    return { format: 'module', source, shortCircuit: true };
  }
  return nextLoad(url, context);
}
