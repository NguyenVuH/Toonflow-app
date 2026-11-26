import { z } from "zod";

export type ToolPermission = "read" | "write_asset" | "write_plan" | "render" | "publish" | "admin";
export type ToolExecutionContext = {
  taskId: string;
  seriesId: string;
  agentId: string;
  allowedToolIds: string[];
  permissions: ToolPermission[];
  signal?: AbortSignal;
};

export type RegisteredTool<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType> = {
  toolId: string;
  version: number;
  description: string;
  inputSchema: I;
  outputSchema: O;
  requiredPermissions: ToolPermission[];
  handler: (input: z.infer<I>, context: ToolExecutionContext) => Promise<z.infer<O>>;
};

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  register<I extends z.ZodType, O extends z.ZodType>(tool: RegisteredTool<I, O>): void {
    if (!/^[a-z][a-z0-9_.-]{1,127}$/.test(tool.toolId)) throw new Error("Invalid tool ID");
    const key = `${tool.toolId}@${tool.version}`;
    if (this.tools.has(key)) throw new Error(`Tool version already registered: ${key}`);
    this.tools.set(key, tool as RegisteredTool);
  }

  describe(): Array<{ toolId: string; version: number; description: string; inputSchema: unknown; requiredPermissions: ToolPermission[] }> {
    return [...this.tools.values()].map(tool => ({
      toolId: tool.toolId, version: tool.version, description: tool.description,
      inputSchema: tool.inputSchema.toJSONSchema(), requiredPermissions: [...tool.requiredPermissions]
    }));
  }

  async execute(toolId: string, version: number, rawInput: unknown, context: ToolExecutionContext): Promise<unknown> {
    if (!context.allowedToolIds.includes(toolId)) throw new Error(`Agent is not allowed to call tool: ${toolId}`);
    const tool = this.tools.get(`${toolId}@${version}`);
    if (!tool) throw new Error(`Tool is not registered: ${toolId}@${version}`);
    for (const permission of tool.requiredPermissions) {
      if (!context.permissions.includes(permission)) throw new Error(`Missing permission ${permission} for tool ${toolId}`);
    }
    if (context.signal?.aborted) throw new Error("Tool execution aborted");
    const input = tool.inputSchema.parse(rawInput);
    const output = await tool.handler(input, context);
    if (context.signal?.aborted) throw new Error("Tool execution aborted");
    return tool.outputSchema.parse(output);
  }
}
