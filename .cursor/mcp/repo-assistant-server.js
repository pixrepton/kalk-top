const fs = require("fs");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..", "..");

function readRelative(relativePath) {
  try {
    return fs.readFileSync(path.join(workspaceRoot, relativePath), "utf8");
  } catch (error) {
    return `Missing file: ${relativePath}`;
  }
}

function listTools() {
  return [
    {
      name: "contract_surface_inspector",
      description: "Inspect the contract surface for kalk-top changes across DTOs, REST, auth, trace, generator, and mail-ingress.",
      inputSchema: {
        type: "object",
        properties: {
          focus: {
            type: "string",
            description: "Focus area such as dto, rest, auth, trace, generator, or mail-ingress.",
          },
        },
      },
    },
    {
      name: "runtime_preflight_reference",
      description: "Return repo-specific runtime verification commands, routes, and preflight references for kalk-top.",
      inputSchema: {
        type: "object",
        properties: {
          area: {
            type: "string",
            description: "Optional area such as rest, workflow, generator, or mail-ingress.",
          },
        },
      },
    },
    {
      name: "route_auth_reference",
      description: "Return route and auth verification guidance for the main kalk-top runtime boundaries.",
      inputSchema: {
        type: "object",
        properties: {
          route: {
            type: "string",
            description: "Optional route focus.",
          },
        },
      },
    },
    {
      name: "architecture_review_inputs",
      description: "Return the architecture review inputs for ownership, change surface, and decision criteria in kalk-top.",
      inputSchema: {
        type: "object",
        properties: {
          change: {
            type: "string",
            description: "Optional short description of the proposed change.",
          },
        },
      },
    },
  ];
}

function listResources() {
  return [
    {
      uri: "kalk-top://current-state",
      name: "Current State",
      mimeType: "text/markdown",
      description: "Current repo and agent-system state.",
    },
    {
      uri: "kalk-top://boundary-map",
      name: "Boundary Map",
      mimeType: "text/markdown",
      description: "Ownership and boundary map for kalk-top and neighboring repos.",
    },
    {
      uri: "kalk-top://verification-surface",
      name: "Verification Surface",
      mimeType: "text/markdown",
      description: "Verification commands and runtime preflight references.",
    },
  ];
}

function listPrompts() {
  return [
    {
      name: "architecture-review",
      description: "Generate an architecture review using ownership, change surface, contracts, rollback, and verification.",
      arguments: [
        {
          name: "change",
          description: "Short description of the proposed change.",
          required: true,
        },
      ],
    },
    {
      name: "change-surface-check",
      description: "Generate a change-surface review before implementation.",
      arguments: [
        {
          name: "change",
          description: "Short description of the proposed change.",
          required: true,
        },
      ],
    },
  ];
}

function buildVerificationSurface() {
  const packageJson = readRelative("package.json");
  const runbook = readRelative("docs/runbooks/manual-runtime-setup.md");
  return [
    "# Verification Surface",
    "",
    "## package.json",
    packageJson,
    "",
    "## manual-runtime-setup",
    runbook,
  ].join("\n");
}

function readResource(uri) {
  if (uri === "kalk-top://current-state") {
    return readRelative("memory-bank/current-state.md");
  }
  if (uri === "kalk-top://boundary-map") {
    return readRelative("docs/architecture/boundary-map.md");
  }
  if (uri === "kalk-top://verification-surface") {
    return buildVerificationSurface();
  }
  return `Unknown resource: ${uri}`;
}

function callTool(name, args) {
  const focus = args && typeof args.focus === "string" ? args.focus : "general";
  const area = args && typeof args.area === "string" ? args.area : "general";
  const route = args && typeof args.route === "string" ? args.route : "general";
  const change = args && typeof args.change === "string" ? args.change : "general";

  if (name === "contract_surface_inspector") {
    return [
      `Contract surface focus: ${focus}`,
      "",
      "Read first:",
      "- docs/contracts/dto-and-boundaries.md",
      "- docs/contracts/field-mapping.md",
      "- docs/ecosystem/TOPINSTAL_ECOSYSTEM_STATE.md",
      "- docs/ecosystem/TOPINSTAL_ECOSYSTEM_UPDATE_PROTOCOL.md",
      "",
      "Key escalation triggers:",
      "- CalcRequestDTO",
      "- OfferDTO",
      "- REST shape",
      "- auth or trace semantics",
      "- generator integration",
      "- mail-ingress workflow",
    ].join("\n");
  }

  if (name === "runtime_preflight_reference") {
    return [
      `Runtime preflight area: ${area}`,
      "",
      "Primary references:",
      "- docs/runbooks/manual-runtime-setup.md",
      "- wp-adapter/rest/CalculateOfferController.php",
      "- wp-adapter/rest/MailIngressWorkflowDiagnosticsController.php",
      "",
      "Primary checks:",
      "- npm run test:rest",
      "- npm run test:mail-ingress-workflow",
      "- npm run test:mail-ingress-live",
      "- GET /wp-json/topinstal/v1/mail-ingress/workflow-preflight",
    ].join("\n");
  }

  if (name === "route_auth_reference") {
    return [
      `Route/auth focus: ${route}`,
      "",
      "Primary route boundary:",
      "- POST /wp-json/topinstal/v1/calculate-offer",
      "",
      "Runtime/auth references:",
      "- docs/contracts/dto-and-boundaries.md",
      "- docs/runbooks/manual-runtime-setup.md",
      "- wp-adapter/rest/CalculateOfferController.php",
      "- wp-adapter/rest/RequestValidator.php",
      "- wp-adapter/rest/MailIngressWorkflowDiagnosticsController.php",
    ].join("\n");
  }

  if (name === "architecture_review_inputs") {
    return [
      `Architecture review change: ${change}`,
      "",
      "Read first:",
      "- docs/architecture/repo-rules.md",
      "- docs/architecture/boundary-map.md",
      "- docs/architecture/change-surface-checklist.md",
      "- docs/architecture/decision-criteria.md",
      "- memory-bank/decisions.md",
      "",
      "Review outputs should cover:",
      "- ownership",
      "- source of truth",
      "- contract risk",
      "- rollback path",
      "- verification path",
    ].join("\n");
  }

  return `Unknown tool: ${name}`;
}

function getPrompt(name, args) {
  const changeArg =
    Array.isArray(args) && args.length > 0 && args[0] && args[0].value
      ? String(args[0].value)
      : "unspecified change";

  if (name === "architecture-review") {
    return {
      description: "Architecture review prompt for kalk-top.",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Review this proposed kalk-top change: ${changeArg}\n\n` +
              "Use docs/architecture/repo-rules.md, boundary-map.md, change-surface-checklist.md, and decision-criteria.md. " +
              "Return ownership, boundary risks, contract risks, rollback path, verify path, and recommendation.",
          },
        },
      ],
    };
  }

  if (name === "change-surface-check") {
    return {
      description: "Change surface prompt for kalk-top.",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Map the change surface for: ${changeArg}\n\n` +
              "Use docs/architecture/change-surface-checklist.md, docs/architecture/boundary-map.md, and docs/contracts/dto-and-boundaries.md. " +
              "Return touched layers, touched contracts, touched runtime, downstream impact, and what must be reviewed before implementation.",
          },
        },
      ],
    };
  }

  return {
    description: `Unknown prompt: ${name}`,
    messages: [],
  };
}

function makeResponse(id, result) {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

function makeError(id, code, message) {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message },
  };
}

function writeMessage(message) {
  const body = JSON.stringify(message);
  const header = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n`;
  process.stdout.write(header + body);
}

function handleMessage(message) {
  const { id, method, params } = message;

  if (method === "initialize") {
    writeMessage(
      makeResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        serverInfo: {
          name: "kalk-top-repo-assistant",
          version: "1.0.0",
        },
      }),
    );
    return;
  }

  if (method === "notifications/initialized") {
    return;
  }

  if (method === "tools/list") {
    writeMessage(makeResponse(id, { tools: listTools() }));
    return;
  }

  if (method === "tools/call") {
    const output = callTool(params.name, params.arguments || {});
    writeMessage(
      makeResponse(id, {
        content: [{ type: "text", text: output }],
        isError: false,
      }),
    );
    return;
  }

  if (method === "resources/list") {
    writeMessage(makeResponse(id, { resources: listResources() }));
    return;
  }

  if (method === "resources/read") {
    const text = readResource(params.uri);
    writeMessage(
      makeResponse(id, {
        contents: [
          {
            uri: params.uri,
            mimeType: "text/markdown",
            text,
          },
        ],
      }),
    );
    return;
  }

  if (method === "prompts/list") {
    writeMessage(makeResponse(id, { prompts: listPrompts() }));
    return;
  }

  if (method === "prompts/get") {
    writeMessage(makeResponse(id, getPrompt(params.name, params.arguments || [])));
    return;
  }

  writeMessage(makeError(id, -32601, `Method not found: ${method}`));
}

let buffer = Buffer.alloc(0);

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);

  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      return;
    }

    const headerText = buffer.slice(0, headerEnd).toString("utf8");
    const match = headerText.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      buffer = Buffer.alloc(0);
      return;
    }

    const contentLength = Number(match[1]);
    const totalLength = headerEnd + 4 + contentLength;
    if (buffer.length < totalLength) {
      return;
    }

    const body = buffer.slice(headerEnd + 4, totalLength).toString("utf8");
    buffer = buffer.slice(totalLength);

    try {
      handleMessage(JSON.parse(body));
    } catch (error) {
      writeMessage(makeError(null, -32700, "Parse error"));
    }
  }
});
