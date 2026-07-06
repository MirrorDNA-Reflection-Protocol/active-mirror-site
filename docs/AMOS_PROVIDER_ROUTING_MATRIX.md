# AMOS Provider Routing Matrix

Status: working architecture note
Last checked: 2026-07-06

## Purpose

Active Mirror should not ask only "which model should answer?"

For enterprise and local-first use, the stronger question is:

> Which trust boundary should this capability run inside?

Models are replaceable workers. The route decides cloud boundary, identity boundary, data boundary, cost path, audit path, and fallback path.

## Current Signals

### Claude Is A Multi-Cloud Capability

Claude should be represented as a capability that can arrive through different enterprise boundaries:

| Route | Boundary | Why It Matters |
|---|---|---|
| Anthropic direct | Anthropic API / Claude Enterprise | Fastest access to Anthropic-native features. |
| Amazon Bedrock | AWS | AWS IAM, regional controls, AWS billing, and Bedrock controls. |
| Claude Platform on AWS | Anthropic API with AWS auth and Marketplace billing | Closer to Anthropic API behavior while using AWS procurement/auth rails. |
| Google Vertex AI | GCP | GCP-native IAM, Vertex AI governance, and GCP billing. |
| Microsoft Foundry | Azure | Azure-native endpoint/auth, RBAC, private networking, and Microsoft Marketplace billing. |
| Claude Apps Gateway | Self-hosted gateway in front of providers | IdP login and enterprise gateway policy in front of Claude/provider routes. |

Decision rule:

> Do not ask "which Claude?" Ask "which approved boundary should Claude run inside?"

### Supra-Router-51M Is An Edge Router Candidate

SupraLabs/Supra-Router-51M is published on Hugging Face as a 51.8M-parameter BF16 text-generation model intended for local prompt routing. The model card describes a router output schema:

```text
Domain | Complexity | Math | Code | Route | Justification
```

Useful AMOS interpretation:

| Supra Router Field | AMOS Use |
|---|---|
| Domain | Task family: reflection, source-check, artifact, code, media, enterprise. |
| Complexity | Local SLM vs frontier threshold input. |
| Math / Code | Tool and model capability flags. |
| Route | Candidate route only, never final authority. |
| Justification | Receipt input for route review, not proof. |

Hard caveat:

Supra-Router-51M is new, tiny, and trained on a small public dataset. Use it only as an advisory candidate router behind deterministic gates. It must not override consent, source requirements, safety gates, enterprise policy, or human approval.

## AMOS Route Profile

```json
{
  "route_profile": {
    "capability": "reflection | source_check | artifact | code | media | enterprise",
    "provider_boundary": "local | anthropic_direct | aws_bedrock | claude_platform_aws | vertex_ai | microsoft_foundry | openai | gemini | apps_gateway",
    "auth_boundary": "api_key | iam | oidc | gcp_iam | azure_entra | local_only",
    "data_boundary": "browser | local_device | private_gateway | provider_cloud | client_cloud",
    "allowed_inputs": ["redacted_user_prompt", "approved_files", "public_sources", "task_packet"],
    "blocked_inputs": ["raw_private_memory", "secrets", "unapproved_client_confidential", "cross-client_context"],
    "requires_source_check": false,
    "requires_human_approval": false,
    "fallback_boundary": "local | same_cloud | approved_secondary_provider | none",
    "receipt_required": true
  }
}
```

## Routing Law

1. Local/private input routes local first.
2. Current external facts route source-check first.
3. Artifacts route to the artifact maker, then deterministic cleanup gates.
4. Enterprise confidential work routes by approved cloud boundary, not model preference.
5. Provider output is advisory until validated by output gates.
6. Small routers such as Supra-Router-51M may propose a route, but policy gates decide.
7. Route failures preserve the task packet and continue only through an approved fallback.

## Sources

- Claude Code enterprise deployment overview: https://code.claude.com/docs/en/third-party-integrations
- Claude Platform on AWS: https://code.claude.com/docs/en/claude-platform-on-aws
- Claude on Vertex AI: https://platform.claude.com/docs/en/build-with-claude/claude-on-vertex-ai
- Claude in Microsoft Foundry: https://platform.claude.com/docs/en/build-with-claude/claude-in-microsoft-foundry
- Amazon Bedrock Claude docs: https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-claude.html
- Supra-Router-51M model card: https://huggingface.co/SupraLabs/Supra-Router-51M
