import { IguhealthDeleteScope } from "@iguhealth/generated-ops/r4";
import { outcomeError, outcomeInfo } from "@iguhealth/operation-outcomes";

import * as scopes from "../../../../../authN/db/scopes/index.js";
import { IGUHealthServerCTX } from "../../../../../fhir-server/types.js";
import InlineOperation from "../../interface.js";

export const IguhealthDeleteScopeInvoke = InlineOperation(
  IguhealthDeleteScope.Op,
  async (ctx: IGUHealthServerCTX, _request, input) => {
    const deleteResult = await scopes.deleteUserScope(
      ctx.store.getClient(),
      ctx.tenant,
      input.client_id,
      ctx.user.payload.sub,
    );

    if (deleteResult.length === 0) {
      return outcomeError("not-found", "No scopes found for the user");
    }

    return outcomeInfo("informational", "Scopes deleted successfully.");
  },
);
