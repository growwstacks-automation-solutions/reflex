// One place that builds the Anthropic client for every Claude call (generate, classify,
// client-name, suggested reply).
//
// An org-level API key (not scoped to a workspace) is rejected unless each request names the
// workspace via the `anthropic-workspace-id` header. Set ANTHROPIC_WORKSPACE_ID (a secret, so
// `wrangler deploy` never wipes it) to send it; leave it unset for a workspace-scoped key.

import Anthropic from "@anthropic-ai/sdk";

export function anthropicClient(apiKey: string, workspaceId?: string): Anthropic {
  const id = workspaceId?.trim();
  return new Anthropic({
    apiKey,
    defaultHeaders: id ? { "anthropic-workspace-id": id } : undefined,
  });
}
