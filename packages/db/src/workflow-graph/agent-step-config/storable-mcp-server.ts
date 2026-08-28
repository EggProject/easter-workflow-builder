/**
 * Tárolható MCP szerver konfiguráció (SPEC-003 4.4, "Az `mcpServers` nem
 * tartalmazhat titkot").
 *
 * A research 1. szekciója négy variánst nevez meg (`stdio`, `sse`, `http`,
 * `sdk`); az `sdk` variáns **nem tárolható**, mert élő szerverpéldányt hordoz,
 * tehát nem szerializálható. Az in-process eszközöket az
 * `AgentStepConfig.agentTools` lista kapcsolja be.
 *
 * A titkot hordozó mezők helyén kizárólag env változó **név** áll: a `stdio`
 * variáns `env` értékrekordja helyett `envNames`, az `sse` és a `http` variáns
 * fejléc értéke helyett `authEnvName`. A tényleges értéket a motor indításkor
 * olvassa ki a folyamat környezetéből.
 *
 * A megtartott, nem titkos mezők neve az SDK `McpServerConfig` alakját követi
 * (`command`, `args`, `url`), forrás: az Agent SDK TypeScript referencia
 * `McpStdioServerConfig` / `McpSSEServerConfig` / `McpHttpServerConfig`
 * definíciója (https://docs.claude.com/en/api/agent-sdk/typescript). A `type`
 * mező itt mindhárom variánson kötelező, mert ez a tárolt alak diszkriminátora
 * (az SDK a `stdio` variánson opcionálisnak engedi).
 */
export interface StorableStdioMcpServer {
  readonly type: 'stdio';
  readonly command: string;
  readonly args: readonly string[];
  /**
  Az átadandó env változók NEVE. Érték soha nem kerül ide.
  */
  readonly envNames: readonly string[];
}

export interface StorableSseMcpServer {
  readonly type: 'sse';
  readonly url: string;
  /**
  Az `Authorization` fejléc értékét adó env változó NEVE, vagy `null`.
  */
  readonly authEnvName: string | null;
}

export interface StorableHttpMcpServer {
  readonly type: 'http';
  readonly url: string;
  /**
  Az `Authorization` fejléc értékét adó env változó NEVE, vagy `null`.
  */
  readonly authEnvName: string | null;
}

export type StorableMcpServer = StorableStdioMcpServer | StorableSseMcpServer | StorableHttpMcpServer;
