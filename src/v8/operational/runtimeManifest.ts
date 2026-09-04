export interface RuntimeManifest {
  readonly schemaVersion: "1";
  readonly runtime: {
    readonly node: string;
    readonly platform: string;
    readonly arch: string;
  };
  readonly project: {
    readonly name: string;
    readonly engine: string;
  };
}

export function createRuntimeManifest(input: {
  node: string;
  platform: string;
  arch: string;
  projectName: string;
  engine: string;
}): RuntimeManifest {
  return {
    schemaVersion: "1",
    runtime: {
      node: input.node,
      platform: input.platform,
      arch: input.arch
    },
    project: {
      name: input.projectName,
      engine: input.engine
    }
  };
}