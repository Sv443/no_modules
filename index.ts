import { readdir, statSync, remove } from "fs-extra";
import prompt from "prompts";
import { resolve, join, basename } from "path";

const { exit } = process;

async function run() {
  const { startPath } = await prompt({
    type: "text",
    message: "Enter the path from which to start recursively deleting node_modules",
    name: "startPath",
  });

  if(!startPath)
    return setImmediate(() => exit(0));

  console.log("Scanning directories...\n");

  (async () => {
    const absPath = resolve(startPath);
    const allPaths = await readdir(absPath, { recursive: true });
    const nodeModulesPaths = [...allPaths]
      .map(p => join(absPath, String(p)))
      .filter(p => {
        return statSync(p).isDirectory()
          && basename(p) === "node_modules"
          && occursOnce(p, "node_modules");
      });

    await continueDel(nodeModulesPaths);

    setImmediate(() => exit(0));
  })();
}

async function continueDel(nodeModulesPaths: string[]) {
  const { confirmDel } = await prompt({
    type: "select",
    name: "confirmDel",
    message: `Are you sure you want to delete ${nodeModulesPaths.length} node_modules folders?`,
    choices: [
      {
        title: "\x1b[31mYes, delete\x1b[0m",
        value: "yes",
      },
      {
        title: "No, cancel",
        value: "no",
      },
      {
        title: "List all paths",
        value: "list",
      },
    ],
  });

  switch(confirmDel) {
  case "yes":
    let deletedAmt = 0;
    const promises = nodeModulesPaths.map(p => new Promise<void>(async (res) => {
      try {
        await remove(p);
        deletedAmt++;
        if(deletedAmt % 5 === 0 && deletedAmt > 0)
          console.log(`Deleting (${deletedAmt}/${nodeModulesPaths.length})...`);
        res();
      }
      catch(err) {
        console.error(`\x1b[31mCouldn't delete path\x1b[0m '${p}' \x1b[31mdue to error:\x1b[0m ${err}`);
      }
    }));

    await Promise.allSettled(promises);

    console.log(`\nDeleted all ${nodeModulesPaths.length} node_modules folders.`);
    break;
  case "list":
    console.log(`\nListing all ${nodeModulesPaths.length} paths to node_modules:\n`);
    console.log(nodeModulesPaths.reduce((a, c, i) => a += `${i !== 0 ? "\n" : ""}- ${c}`, ""));
    console.log();

    return continueDel(nodeModulesPaths);
  default:
  case "no":
    return;
  }
}

function occursOnce(input: string, test: string) {
  const results = [...input.matchAll(new RegExp(test, "gmi"))];
  return results.length === 1;
}

run();
