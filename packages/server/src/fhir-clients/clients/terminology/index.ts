import { AsynchronousClient } from "@iguhealth/client";
import { FHIRClientAsync } from "@iguhealth/client/lib/interface";
import { AllInteractions, RequestType } from "@iguhealth/client/lib/types";
import {
  MiddlewareAsync,
  createMiddlewareAsync,
} from "@iguhealth/client/middleware";
import { ResourceType } from "@iguhealth/fhir-types/r4/types";
import { TenantId } from "@iguhealth/jwt/types";

import { IGUHealthServerCTX, asRoot } from "../../../fhir-server/types.js";
import validateOperationsAllowed from "../../middleware/validate-operations-allowed.js";
import validateResourceTypesAllowedMiddleware from "../../middleware/validate-resourcetype.js";

export const TERMINOLOGY_RESOURCE_TYPES: ResourceType[] = [
  "ValueSet",
  "CodeSystem",
];
export const TERMINOLOGY_METHODS_ALLOWED: RequestType[AllInteractions][] = [
  "read-request",
  "search-request",
];

function createTerminologyMiddleware<
  State extends {
    fhirDB: IGUHealthServerCTX["client"];
  },
  CTX extends IGUHealthServerCTX,
>(): MiddlewareAsync<State, CTX> {
  return createMiddlewareAsync<State, CTX>([
    validateResourceTypesAllowedMiddleware(TERMINOLOGY_RESOURCE_TYPES),
    validateOperationsAllowed(TERMINOLOGY_METHODS_ALLOWED),
    async (context) => {
      const response = await context.state.fhirDB.request(
        asRoot({ ...context.ctx, tenant: "iguhealth" as TenantId }),
        context.request,
      );

      return {
        ...context,
        response,
      };
    },
  ]);
}

export function createTerminologyClient<CTX extends IGUHealthServerCTX>(
  fhirDB: IGUHealthServerCTX["client"],
): FHIRClientAsync<CTX> {
  return new AsynchronousClient<{ fhirDB: IGUHealthServerCTX["client"] }, CTX>(
    { fhirDB },
    createTerminologyMiddleware(),
  );
}
