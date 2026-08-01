// Lightweight syntax-only check (no type-checking, no module resolution)
// since npm registry access is blocked in this sandbox and node_modules
// can't be installed here. Uses the globally available `typescript`
// package to parse+transpile every source file individually and report
// any parse errors. Run: node scripts/syntax-check.js
const fs = require("fs");
const path = require("path");
const ts = require("/home/claude/.npm-global/lib/node_modules/typescript");

const SRC = path.join(__dirname, "..", "src");
const PRISMA = path.join(__dirname, "..", "prisma");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
}

const files = [];
walk(SRC, files);
walk(PRISMA, files);

let errorCount = 0;
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      isolatedModules: true,
    },
    reportDiagnostics: true,
    fileName: file,
  });
  const diags = (result.diagnostics || []).filter(
    (d) => d.category === ts.DiagnosticCategory.Error
  );
  if (diags.length > 0) {
    errorCount += diags.length;
    console.log(`\n${path.relative(process.cwd(), file)}`);
    for (const d of diags) {
      const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
      if (d.file && d.start !== undefined) {
        const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
        console.log(`  ${line + 1}:${character + 1} ${msg}`);
      } else {
        console.log(`  ${msg}`);
      }
    }
  }
}

console.log(`\nChecked ${files.length} files, ${errorCount} syntax error(s).`);
process.exit(errorCount > 0 ? 1 : 0);
