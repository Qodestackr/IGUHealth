import { FHIRClientAsync } from "@iguhealth/client/interface";
import { InvokeRequest } from "@iguhealth/client/types";
import {
  OperationDefinition,
  OperationOutcome,
  code,
  uri,
} from "@iguhealth/fhir-types/r4/types";
import { FHIR_VERSION, R4, Resource } from "@iguhealth/fhir-types/versions";
import { evaluate } from "@iguhealth/fhirpath";
import { OpCTX } from "@iguhealth/operation-execution";
import {
  OperationError,
  outcomeError,
  outcomeFatal,
} from "@iguhealth/operation-outcomes";

import { IGUHealthServerCTX } from "../fhir-server/types.js";

export async function resolveOperationDefinition<
  CTX,
  Version extends FHIR_VERSION,
  Client extends FHIRClientAsync<CTX>,
>(
  client: Client,
  ctx: CTX,
  fhirVersion: Version,
  operationCode: string,
): Promise<Resource<Version, "OperationDefinition">> {
  const operationDefinition = await client.search_type(
    ctx,
    fhirVersion,
    "OperationDefinition",
    [{ name: "code", value: [operationCode] }],
  );
  if (operationDefinition.resources.length === 0)
    throw new OperationError(
      outcomeError(
        "not-found",
        `Operation with code '${operationCode}' was not found.`,
      ),
    );
  if (operationDefinition.resources.length > 1)
    throw new OperationError(
      outcomeError(
        "invalid",
        `Operation with code '${operationCode}' had several operation definitions present.`,
      ),
    );

  return operationDefinition.resources[0];
}

const EXT_URL =
  "https://iguhealth.github.io/fhir-operation-definition/operation-code";

export async function getOperationCode(
  ctx: IGUHealthServerCTX,
  operation: OperationDefinition,
): Promise<string | undefined> {
  const code = await evaluate(
    "$this.extension.where(url=%codeUrl).value",
    operation,
    {
      variables: {
        codeUrl: EXT_URL,
      },
    },
  );
  if (code.length === 0) return undefined;
  if (typeof code[0] !== "string")
    throw new OperationError(
      outcomeFatal(
        "invalid",
        "Expected code to be a string for operation '${operation.id}'",
      ),
    );

  return code[0];
}

export function getOpCTX(
  ctx: IGUHealthServerCTX,
  request: InvokeRequest<R4>,
): OpCTX {
  return {
    fhirVersion: request.fhirVersion,
    level: request.level,
    validateCode: async (url: string, code: string) => {
      if (!ctx.terminologyProvider) return true;
      const result = await ctx.terminologyProvider.validate(
        ctx,
        request.fhirVersion,
        {
          code: code as code,
          url: url as uri,
        },
      );
      return result.result;
    },
    resolveCanonical: async (fhirVersion, type, uri) =>
      (await ctx.resolveCanonical(ctx, fhirVersion, type, [uri]))[0],
  };
}

function validateLevel(
  operation: OperationDefinition,
  request: InvokeRequest<R4>,
) {
  switch (request.level) {
    case "system": {
      if (!operation.system)
        return outcomeError(
          "invalid",
          "Operation does not support system level invocation",
        );

      break;
    }
    case "type":
      if (!operation.type) {
        return outcomeError(
          "invalid",
          "Operation does not support type level invocation",
        );
      }
      break;
    case "instance":
      if (!operation.instance) {
        return outcomeError(
          "invalid",
          "Operation does not support instance level invocation",
        );
      }
      break;
  }
}

export function validateInvocationContext(
  operation: OperationDefinition,
  request: InvokeRequest<R4>,
): OperationOutcome | undefined {
  const issues = validateLevel(operation, request);
  if (issues) return issues;

  if (request.level === "instance" || request.level === "type") {
    if (operation.resource?.includes("Resource" as code)) {
      return;
    } else if (!operation.resource?.includes(request.resource as code))
      return outcomeError(
        "invalid",
        `Invalid resourcetype on invocation request '${
          request.resource
        }' expected one of '${operation.resource?.join(", ")}'`,
      );
  }
}
