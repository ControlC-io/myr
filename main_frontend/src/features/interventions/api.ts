import { postJson } from "../../api/client";
import type { InterventionsParams, InterventionsPayload } from "./types";

const INTERVENTIONS_PROXY_PATH = (orgId: string) =>
  `/orgs/${orgId}/proxy/interventions`;

export async function fetchInterventions(
  params: InterventionsParams,
  jwtToken: string,
): Promise<InterventionsPayload> {
  const { orgId, dateBegin } = params;
  const body = dateBegin ? { dateBegin } : {};
  return postJson<typeof body, InterventionsPayload>(
    INTERVENTIONS_PROXY_PATH(orgId),
    body,
    { Authorization: `Bearer ${jwtToken}` },
  );
}
